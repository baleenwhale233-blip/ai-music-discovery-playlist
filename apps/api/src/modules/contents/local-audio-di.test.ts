import "reflect-metadata";

import { Module, NotFoundException } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../platform/prisma/prisma.service";
import { LocalAudioCleanupService } from "./local-audio-cleanup.service";
import { FileHashService } from "./local-audio-file-hash.service";
import { LocalAudioJobRunnerService } from "./local-audio-job-runner.service";
import { LocalAudioPathService } from "./local-audio-path.service";
import { LocalAudioService } from "./local-audio.service";
import { LocalAudioStagingStorageService } from "./local-audio-staging-storage.service";
import { LocalAudioTempStorageService } from "./local-audio-temp-storage.service";
import { LocalAudioWorkerService } from "./local-audio-worker.service";

const prismaMock = {
  sourceContent: {
    findUnique: vi.fn(async () => null)
  },
  localAudioAsset: {
    findMany: vi.fn(async () => []),
    findFirst: vi.fn(async () => null),
    create: vi.fn(),
    update: vi.fn()
  },
  conversionTask: {
    findFirst: vi.fn(async () => null),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  }
};

@Module({
  providers: [
    { provide: PrismaService, useValue: prismaMock },
    LocalAudioPathService,
    LocalAudioStagingStorageService,
    LocalAudioTempStorageService,
    FileHashService,
    { provide: "SourceMediaDownloader", useValue: { download: vi.fn() } },
    { provide: "AudioConverter", useValue: { convert: vi.fn() } },
    LocalAudioWorkerService,
    LocalAudioJobRunnerService,
    LocalAudioCleanupService,
    LocalAudioService
  ]
})
class LocalAudioDiTestModule {}

describe("local audio Nest dependency injection", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("resolves local audio providers with explicit injection tokens", async () => {
    const app = await NestFactory.createApplicationContext(LocalAudioDiTestModule, { logger: false });

    const localAudio = app.get(LocalAudioService);
    const worker = app.get(LocalAudioWorkerService);
    const cleanup = app.get(LocalAudioCleanupService);

    await expect(localAudio.requestCache("user-1", { sourceContentId: "missing-content" })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(worker.runTask("missing-task")).resolves.toBeUndefined();
    await expect(cleanup.cleanupExpired(new Date("2026-05-16T00:00:00.000Z"))).resolves.toEqual({
      expiredArtifactsDeleted: 0,
      staleTempDirsDeleted: 0
    });

    await app.close();
  });
});
