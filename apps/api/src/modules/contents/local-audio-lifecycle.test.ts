import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LocalAudioCleanupService } from "./local-audio-cleanup.service";
import { FileHashService } from "./local-audio-file-hash.service";
import { LocalAudioPathService } from "./local-audio-path.service";
import { LocalAudioService } from "./local-audio.service";
import { LocalAudioStagingStorageService } from "./local-audio-staging-storage.service";
import { LocalAudioTempStorageService } from "./local-audio-temp-storage.service";
import type { AudioConverter, SourceMediaDownloader } from "./local-audio-worker.service";
import { LocalAudioWorkerService } from "./local-audio-worker.service";

type AssetRecord = {
  id: string;
  userId: string;
  sourceContentId: string;
  cacheKey: string;
  storageType: "SELF_HOSTED_NODE" | "USER_DEVICE";
  relativeFilePath: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  durationSec: number | null;
  status: "PENDING" | "CACHING" | "READY" | "FAILED" | "DELETED";
  lastError: string | null;
  sha256: string | null;
  serverArtifactExpiresAt: Date | null;
  clientCachedAt: Date | null;
  serverDeletedAt: Date | null;
  clientStorageKind: string | null;
  clientStorageKey: string | null;
};

type TaskRecord = {
  id: string;
  userId: string;
  sourceContentId: string;
  localAudioAssetId: string;
  taskType: "CACHE_AUDIO";
  status: "CREATED" | "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  runnerType: "UNKNOWN" | "SELF_HOSTED_NODE";
  runnerLabel: string | null;
  attempts: number;
  errorMessage: string | null;
  payloadJson: unknown;
  startedAt: Date | null;
  finishedAt: Date | null;
};

class FakePrisma {
  sourceContents = new Map<string, { id: string; userId?: string; canonicalUrl: string; platform: "BILIBILI"; platformContentId: string; durationSec: number | null }>();
  assets = new Map<string, AssetRecord>();
  tasks = new Map<string, TaskRecord>();
  nextAsset = 1;
  nextTask = 1;

  sourceContent = {
    findUnique: async ({ where }: { where: { id: string } }) => this.sourceContents.get(where.id) ?? null
  };

  localAudioAsset = {
    findFirst: async ({ where }: { where: Partial<AssetRecord> & { id?: string } }) => {
      return [...this.assets.values()].find((asset) => {
        if (where.id && asset.id !== where.id) return false;
        if (where.userId && asset.userId !== where.userId) return false;
        if (where.sourceContentId && asset.sourceContentId !== where.sourceContentId) return false;
        if (where.status) {
          if (typeof where.status === "string" && asset.status !== where.status) return false;
          if (
            typeof where.status === "object" &&
            where.status !== null &&
            "not" in where.status &&
            asset.status === (where.status as { not: string }).not
          ) return false;
        }
        return true;
      }) ?? null;
    },
    findMany: async ({ where }: { where?: { storageType?: string; status?: string; serverArtifactExpiresAt?: { lt: Date } } }) => {
      return [...this.assets.values()].filter((asset) => {
        if (!where) return true;
        if (where.storageType && asset.storageType !== where.storageType) return false;
        if (where.status && asset.status !== where.status) return false;
        if (where.serverArtifactExpiresAt?.lt && (!asset.serverArtifactExpiresAt || asset.serverArtifactExpiresAt >= where.serverArtifactExpiresAt.lt)) return false;
        return true;
      });
    },
    create: async ({ data }: { data: Omit<AssetRecord, "id"> }) => {
      const asset = { ...data, id: `asset-${this.nextAsset++}` };
      this.assets.set(asset.id, asset);
      return asset;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<AssetRecord> }) => {
      const existing = this.assets.get(where.id);
      if (!existing) throw new Error("asset not found");
      const updated = { ...existing, ...data };
      this.assets.set(where.id, updated);
      return updated;
    }
  };

  conversionTask = {
    create: async ({ data }: { data: Omit<TaskRecord, "id"> }) => {
      const task = { ...data, id: `task-${this.nextTask++}` };
      this.tasks.set(task.id, task);
      return task;
    },
    findFirst: async ({ where }: { where: { id?: string; userId?: string } }) => {
      return [...this.tasks.values()].find((task) => {
        if (where.id && task.id !== where.id) return false;
        if (where.userId && task.userId !== where.userId) return false;
        return true;
      }) ?? null;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<TaskRecord> }) => {
      const existing = this.tasks.get(where.id);
      if (!existing) throw new Error("task not found");
      const updated = { ...existing, ...data };
      this.tasks.set(where.id, updated);
      return updated;
    },
    updateMany: async ({ where, data }: { where: { id: string; status?: { in: string[] } }; data: Partial<TaskRecord> }) => {
      const existing = this.tasks.get(where.id);
      if (!existing || (where.status && !where.status.in.includes(existing.status))) {
        return { count: 0 };
      }
      this.tasks.set(where.id, { ...existing, ...data });
      return { count: 1 };
    }
  };
}

class FakeRunner {
  enqueued: string[] = [];
  enqueue(taskId: string) {
    this.enqueued.push(taskId);
  }
}

class FakeDownloader implements SourceMediaDownloader {
  async download(input: { outputPath: string }) {
    writeFileSync(input.outputPath, "source-video");
    return { sourcePath: input.outputPath };
  }
}

class FailingDownloader implements SourceMediaDownloader {
  async download(input: { outputPath: string }): Promise<{ sourcePath: string }> {
    writeFileSync(input.outputPath, "partial-source");
    throw new Error("download exploded");
  }
}

class FailingHashService {
  async sha256File() {
    throw new Error("hash exploded");
  }
}

class FakeConverter implements AudioConverter {
  async convert(input: { sourcePath: string; outputPath: string }) {
    expect(readFileSync(input.sourcePath, "utf8")).toBe("source-video");
    writeFileSync(input.outputPath, "deterministic audio");
    return {
      outputPath: input.outputPath,
      mimeType: "audio/mp4",
      durationSec: 42
    };
  }
}

describe("task-based local audio lifecycle", () => {
  let root: string;
  let prisma: FakePrisma;
  let pathService: LocalAudioPathService;
  let staging: LocalAudioStagingStorageService;
  let temp: LocalAudioTempStorageService;
  let hash: FileHashService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "local-audio-lifecycle-"));
    prisma = new FakePrisma();
    prisma.sourceContents.set("content-1", {
      id: "content-1",
      canonicalUrl: "https://www.bilibili.com/video/BV1B7411m7LV?p=1",
      platform: "BILIBILI",
      platformContentId: "BV1B7411m7LV",
      durationSec: 42
    });
    pathService = new LocalAudioPathService({
      tempRoot: join(root, "tmp"),
      stagingRoot: join(root, "staging"),
      cacheRoot: join(root, "cache")
    });
    staging = new LocalAudioStagingStorageService(pathService);
    temp = new LocalAudioTempStorageService(pathService);
    hash = new FileHashService();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("creates or reuses an asset and creates a queued task", async () => {
    const runner = new FakeRunner();
    const service = new LocalAudioService(prisma as never, staging, runner as never, { workerEnabled: true });

    const first = await service.requestCache("user-1", { sourceContentId: "content-1" });
    const second = await service.requestCache("user-1", { sourceContentId: "content-1" });

    expect(first.assetId).toBe(second.assetId);
    expect(first.assetStatus).toBe("pending");
    expect(first.taskStatus).toBe("queued");
    expect(prisma.assets.size).toBe(1);
    expect(prisma.tasks.size).toBe(2);
    expect(runner.enqueued).toEqual([first.taskId, second.taskId]);
  });

  it("re-cache requests clear old staging metadata and delete stale server artifacts", async () => {
    const service = new LocalAudioService(prisma as never, staging, new FakeRunner() as never, { workerEnabled: false });
    const request = await service.requestCache("user-1", { sourceContentId: "content-1" });
    const source = join(root, "old-ready.m4a");
    writeFileSync(source, "old audio");
    const staged = await staging.stageArtifact({
      assetId: request.assetId,
      sourcePath: source,
      extension: ".m4a"
    });
    await prisma.localAudioAsset.update({
      where: { id: request.assetId },
      data: {
        status: "READY",
        storageType: "SELF_HOSTED_NODE",
        relativeFilePath: staged.relativePath,
        mimeType: "audio/mp4",
        fileSizeBytes: statSync(staged.absolutePath).size,
        durationSec: 42,
        sha256: await hash.sha256File(staged.absolutePath),
        serverArtifactExpiresAt: new Date(Date.now() + 1000)
      }
    });

    const next = await service.requestCache("user-1", { sourceContentId: "content-1" });
    const asset = prisma.assets.get(request.assetId);

    expect(next.assetId).toBe(request.assetId);
    expect(asset?.status).toBe("PENDING");
    expect(asset?.relativeFilePath).toBeNull();
    expect(asset?.sha256).toBeNull();
    expect(asset?.serverArtifactExpiresAt).toBeNull();
    expect(existsSync(staged.absolutePath)).toBe(false);
  });

  it("runs a successful worker task, stages the final artifact, and deletes temp files", async () => {
    const runner = new FakeRunner();
    const service = new LocalAudioService(prisma as never, staging, runner as never, { workerEnabled: false });
    const request = await service.requestCache("user-1", { sourceContentId: "content-1" });
    const worker = new LocalAudioWorkerService(
      prisma as never,
      temp,
      staging,
      hash,
      new FakeDownloader(),
      new FakeConverter(),
      { stagingTtlHours: 24 },
    );

    await worker.runTask(request.taskId);

    const task = prisma.tasks.get(request.taskId);
    const asset = prisma.assets.get(request.assetId);
    expect(task?.status).toBe("SUCCEEDED");
    expect(asset?.status).toBe("READY");
    expect(asset?.storageType).toBe("SELF_HOSTED_NODE");
    expect(asset?.relativeFilePath).toMatch(/^asset-1\/.+\.m4a$/);
    expect(asset?.mimeType).toBe("audio/mp4");
    expect(asset?.fileSizeBytes).toBe(statSync(staging.resolveRelativePath(asset?.relativeFilePath ?? "")).size);
    expect(asset?.sha256).toHaveLength(64);
    expect(asset?.durationSec).toBe(42);
    expect(existsSync(join(root, "tmp", request.taskId))).toBe(false);
    expect(existsSync(staging.resolveRelativePath(asset?.relativeFilePath ?? ""))).toBe(true);
  });

  it("marks failed worker tasks and deletes temp files", async () => {
    const runner = new FakeRunner();
    const service = new LocalAudioService(prisma as never, staging, runner as never, { workerEnabled: false });
    const request = await service.requestCache("user-1", { sourceContentId: "content-1" });
    const worker = new LocalAudioWorkerService(
      prisma as never,
      temp,
      staging,
      hash,
      new FailingDownloader(),
      new FakeConverter(),
      { stagingTtlHours: 24 },
    );

    await worker.runTask(request.taskId);

    expect(prisma.tasks.get(request.taskId)?.status).toBe("FAILED");
    expect(prisma.tasks.get(request.taskId)?.errorMessage).toContain("download exploded");
    expect(prisma.assets.get(request.assetId)?.status).toBe("FAILED");
    expect(existsSync(join(root, "tmp", request.taskId))).toBe(false);
  });

  it("cleans a staged artifact if the worker fails after moving output to staging", async () => {
    const service = new LocalAudioService(prisma as never, staging, new FakeRunner() as never, { workerEnabled: false });
    const request = await service.requestCache("user-1", { sourceContentId: "content-1" });
    const worker = new LocalAudioWorkerService(
      prisma as never,
      temp,
      staging,
      new FailingHashService() as never,
      new FakeDownloader(),
      new FakeConverter(),
      { stagingTtlHours: 24 },
    );

    await worker.runTask(request.taskId);

    const stagingAssetDir = join(root, "staging", request.assetId);
    expect(prisma.tasks.get(request.taskId)?.status).toBe("FAILED");
    expect(prisma.assets.get(request.assetId)?.relativeFilePath).toBeNull();
    expect(existsSync(stagingAssetDir) ? readdirSync(stagingAssetDir) : []).toHaveLength(0);
  });

  it("confirms client cache, verifies hash and size, deletes staging, and marks the asset as user-device", async () => {
    const service = new LocalAudioService(prisma as never, staging, new FakeRunner() as never, { workerEnabled: false });
    const request = await service.requestCache("user-1", { sourceContentId: "content-1" });
    const source = join(root, "ready.m4a");
    writeFileSync(source, "saved audio");
    const staged = await staging.stageArtifact({
      assetId: request.assetId,
      sourcePath: source,
      extension: ".m4a"
    });
    const sha256 = await hash.sha256File(staged.absolutePath);
    await prisma.localAudioAsset.update({
      where: { id: request.assetId },
      data: {
        status: "READY",
        storageType: "SELF_HOSTED_NODE",
        relativeFilePath: staged.relativePath,
        fileSizeBytes: statSync(staged.absolutePath).size,
        sha256
      }
    });

    const response = await service.confirmClientCache("user-1", request.assetId, {
      sha256,
      sizeBytes: statSync(staged.absolutePath).size,
      clientStorageKind: "opfs",
      clientStorageKey: "opfs-track"
    });

    const asset = prisma.assets.get(request.assetId);
    expect(response.storageType).toBe("user_device");
    expect(asset?.storageType).toBe("USER_DEVICE");
    expect(asset?.relativeFilePath).toBeNull();
    expect(asset?.clientCachedAt).toBeInstanceOf(Date);
    expect(asset?.serverDeletedAt).toBeInstanceOf(Date);
    expect(existsSync(staged.absolutePath)).toBe(false);
  });

  it("rejects client confirmation with the wrong hash and preserves staging", async () => {
    const service = new LocalAudioService(prisma as never, staging, new FakeRunner() as never, { workerEnabled: false });
    const request = await service.requestCache("user-1", { sourceContentId: "content-1" });
    mkdirSync(join(root, "staging", request.assetId), { recursive: true });
    const artifact = join(root, "staging", request.assetId, "artifact.m4a");
    writeFileSync(artifact, "saved audio");
    const sha256 = await hash.sha256File(artifact);
    await prisma.localAudioAsset.update({
      where: { id: request.assetId },
      data: {
        status: "READY",
        storageType: "SELF_HOSTED_NODE",
        relativeFilePath: `${request.assetId}/artifact.m4a`,
        fileSizeBytes: statSync(artifact).size,
        sha256
      }
    });

    await expect(service.confirmClientCache("user-1", request.assetId, {
      sha256: "b".repeat(64),
      sizeBytes: statSync(artifact).size,
      clientStorageKind: "opfs"
    })).rejects.toThrow("does not match");
    expect(existsSync(artifact)).toBe(true);
  });

  it("prevents users from confirming another user's asset", async () => {
    const service = new LocalAudioService(prisma as never, staging, new FakeRunner() as never, { workerEnabled: false });
    const request = await service.requestCache("user-1", { sourceContentId: "content-1" });

    await expect(service.confirmClientCache("user-2", request.assetId, {
      sha256: "a".repeat(64),
      sizeBytes: 1,
      clientStorageKind: "opfs"
    })).rejects.toThrow("not found");
  });

  it("cleans expired staging files and stale temp dirs without deleting outside roots", async () => {
    const cleanup = new LocalAudioCleanupService(prisma as never, staging, temp, { tempTtlHours: 1 });
    const service = new LocalAudioService(prisma as never, staging, new FakeRunner() as never, { workerEnabled: false });
    const request = await service.requestCache("user-1", { sourceContentId: "content-1" });
    mkdirSync(join(root, "staging", request.assetId), { recursive: true });
    const artifact = join(root, "staging", request.assetId, "expired.m4a");
    writeFileSync(artifact, "expired audio");
    await prisma.localAudioAsset.update({
      where: { id: request.assetId },
      data: {
        status: "READY",
        storageType: "SELF_HOSTED_NODE",
        relativeFilePath: `${request.assetId}/expired.m4a`,
        serverArtifactExpiresAt: new Date(Date.now() - 1000)
      }
    });
    const staleDir = join(root, "tmp", "task-stale");
    mkdirSync(staleDir, { recursive: true });
    writeFileSync(join(staleDir, "source.mp4"), "stale");
    const staleTime = new Date(Date.now() - 2 * 60 * 60 * 1000);
    utimesSync(staleDir, staleTime, staleTime);
    const outside = join(root, "outside.txt");
    writeFileSync(outside, "outside");

    const result = await cleanup.cleanupExpired(new Date());

    expect(result.expiredArtifactsDeleted).toBe(1);
    expect(result.staleTempDirsDeleted).toBe(1);
    expect(existsSync(artifact)).toBe(false);
    expect(existsSync(staleDir)).toBe(false);
    expect(existsSync(outside)).toBe(true);
    expect(prisma.assets.get(request.assetId)?.status).toBe("FAILED");
  });

  it("rejects staging path traversal", () => {
    expect(() => staging.resolveRelativePath("../outside.m4a")).toThrow("escapes");
  });
});
