import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type {
  LocalAudioCacheRequestCreate,
  LocalAudioCacheRequestCreateResponse,
  LocalAudioConfirmClientCacheRequest,
  LocalAudioConfirmClientCacheResponse,
  LocalAudioTaskStatusResponse
} from "@ai-music-playlist/api-contract";

import { appEnv } from "../../config/env";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { toSafeCacheKey } from "./local-audio-cache";
import { LocalAudioJobRunnerService } from "./local-audio-job-runner.service";
import { LocalAudioStagingStorageService } from "./local-audio-staging-storage.service";

type LocalAudioAssetRecord = {
  id: string;
  userId: string;
  sourceContentId: string;
  cacheKey: string;
  storageType: string;
  relativeFilePath: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  durationSec: number | null;
  status: string;
  lastError: string | null;
  sha256?: string | null;
  serverArtifactExpiresAt?: Date | null;
  clientCachedAt?: Date | null;
  serverDeletedAt?: Date | null;
  clientStorageKind?: string | null;
  clientStorageKey?: string | null;
};

type ConversionTaskRecord = {
  id: string;
  userId: string;
  sourceContentId: string | null;
  localAudioAssetId: string | null;
  status: string;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
};

type PrismaLocalAudioClient = {
  sourceContent: {
    findUnique(input: { where: { id: string } }): Promise<{
      id: string;
      platform: string;
      platformContentId: string;
    } | null>;
  };
  localAudioAsset: {
    findFirst(input: { where: Record<string, unknown> }): Promise<LocalAudioAssetRecord | null>;
    create(input: { data: Record<string, unknown> }): Promise<LocalAudioAssetRecord>;
    update(input: { where: { id: string }; data: Record<string, unknown> }): Promise<LocalAudioAssetRecord>;
  };
  conversionTask: {
    create(input: { data: Record<string, unknown> }): Promise<ConversionTaskRecord>;
    findFirst(input: { where: Record<string, unknown> }): Promise<ConversionTaskRecord | null>;
  };
};

@Injectable()
export class LocalAudioService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaLocalAudioClient,
    @Inject(LocalAudioStagingStorageService)
    private readonly stagingStorage: LocalAudioStagingStorageService,
    @Inject(LocalAudioJobRunnerService)
    private readonly runner: LocalAudioJobRunnerService,
    @Optional() options?: { workerEnabled: boolean },
  ) {
    this.options = options ?? { workerEnabled: appEnv.LOCAL_AUDIO_WORKER_ENABLED };
  }

  private readonly options: { workerEnabled: boolean };

  async requestCache(userId: string, input: LocalAudioCacheRequestCreate): Promise<LocalAudioCacheRequestCreateResponse> {
    const sourceContent = await this.prisma.sourceContent.findUnique({
      where: { id: input.sourceContentId }
    });

    if (!sourceContent) {
      throw new NotFoundException("Source content not found");
    }

    if (sourceContent.platform !== "BILIBILI") {
      throw new BadRequestException("Only Bilibili source content can be cached locally");
    }

    const existing = await this.prisma.localAudioAsset.findFirst({
      where: {
        userId,
        sourceContentId: sourceContent.id
      }
    });
    const cacheKey = toSafeCacheKey(`${userId}_${sourceContent.platformContentId}`);
    const asset = existing
      ? await this.prisma.localAudioAsset.update({
        where: { id: existing.id },
        data: {
          status: "PENDING",
          storageType: "SELF_HOSTED_NODE",
          lastError: null,
          deletedAt: null
        }
      })
      : await this.prisma.localAudioAsset.create({
        data: {
          userId,
          sourceContentId: sourceContent.id,
          cacheKey,
          storageType: "SELF_HOSTED_NODE",
          relativeFilePath: null,
          coverRelativePath: null,
          mimeType: null,
          fileSizeBytes: null,
          durationSec: null,
          status: "PENDING",
          lastError: null,
          lastAccessedAt: null,
          deletedAt: null
        }
      });
    const task = await this.prisma.conversionTask.create({
      data: {
        userId,
        sourceContentId: sourceContent.id,
        localAudioAssetId: asset.id,
        taskType: "CACHE_AUDIO",
        status: "QUEUED",
        runnerType: "UNKNOWN",
        attempts: 0,
        priority: 100,
        errorMessage: null,
        payloadJson: {
          sourceContentId: sourceContent.id,
          playlistId: input.playlistId ?? null,
          playlistItemId: input.playlistItemId ?? null
        },
        startedAt: null,
        finishedAt: null
      }
    });

    if (this.options.workerEnabled) {
      this.runner.enqueue(task.id);
    }

    return {
      assetId: asset.id,
      taskId: task.id,
      assetStatus: "pending",
      taskStatus: "queued"
    };
  }

  async getTaskStatus(userId: string, taskId: string): Promise<LocalAudioTaskStatusResponse> {
    const task = await this.prisma.conversionTask.findFirst({
      where: {
        id: taskId,
        userId
      }
    });

    if (!task) {
      throw new NotFoundException("Conversion task not found");
    }

    return {
      taskId: task.id,
      assetId: task.localAudioAssetId,
      status: toContractTaskStatus(task.status),
      progress: null,
      errorMessage: task.errorMessage,
      startedAt: task.startedAt?.toISOString() ?? null,
      finishedAt: task.finishedAt?.toISOString() ?? null,
      artifactReady: task.status === "SUCCEEDED"
    };
  }

  async getDownloadableAsset(userId: string, assetId: string) {
    const asset = await this.findOwnedAsset(userId, assetId);

    if (asset.status !== "READY" || asset.storageType !== "SELF_HOSTED_NODE" || !asset.relativeFilePath) {
      throw new BadRequestException("Local audio asset is not available for download");
    }

    if (asset.serverArtifactExpiresAt && asset.serverArtifactExpiresAt < new Date()) {
      throw new BadRequestException("Local audio staging artifact has expired");
    }

    const stream = await this.stagingStorage.openReadStream(asset.relativeFilePath);

    return {
      ...stream,
      contentType: asset.mimeType ?? "audio/mp4",
      totalSize: asset.fileSizeBytes ?? stream.totalSize
    };
  }

  async getDownloadableAssetRange(userId: string, assetId: string, range: { start: number; end: number }) {
    const asset = await this.getDownloadableAsset(userId, assetId);

    return {
      ...asset,
      stream: this.stagingStorage.createReadStream(
        (await this.findOwnedAsset(userId, assetId)).relativeFilePath ?? "",
        range,
      )
    };
  }

  async confirmClientCache(
    userId: string,
    assetId: string,
    input: LocalAudioConfirmClientCacheRequest,
  ): Promise<LocalAudioConfirmClientCacheResponse> {
    const asset = await this.findOwnedAsset(userId, assetId);

    if (asset.status !== "READY" || asset.storageType !== "SELF_HOSTED_NODE") {
      throw new BadRequestException("Local audio asset is not ready for client confirmation");
    }

    if (!asset.relativeFilePath || !asset.sha256 || asset.fileSizeBytes === null) {
      throw new BadRequestException("Local audio asset is missing staging metadata");
    }

    if (asset.sha256.toLowerCase() !== input.sha256.toLowerCase()) {
      throw new BadRequestException("Client cache sha256 does not match server artifact");
    }

    if (asset.fileSizeBytes !== input.sizeBytes) {
      throw new BadRequestException("Client cache size does not match server artifact");
    }

    await this.stagingStorage.deleteRelativePath(asset.relativeFilePath);
    const now = new Date();
    const updated = await this.prisma.localAudioAsset.update({
      where: { id: asset.id },
      data: {
        status: "READY",
        storageType: "USER_DEVICE",
        relativeFilePath: null,
        clientCachedAt: now,
        serverDeletedAt: now,
        serverArtifactExpiresAt: null,
        clientStorageKind: input.clientStorageKind,
        clientStorageKey: input.clientStorageKey ?? null,
        lastError: null
      }
    });

    return {
      assetId: updated.id,
      status: "ready",
      storageType: "user_device",
      sha256: updated.sha256 ?? null,
      sizeBytes: updated.fileSizeBytes ?? null,
      clientCachedAt: updated.clientCachedAt?.toISOString() ?? null,
      serverDeletedAt: updated.serverDeletedAt?.toISOString() ?? null
    };
  }

  private async findOwnedAsset(userId: string, assetId: string) {
    const asset = await this.prisma.localAudioAsset.findFirst({
      where: {
        id: assetId,
        userId,
        status: {
          not: "DELETED"
        }
      }
    });

    if (!asset) {
      throw new NotFoundException("Local audio asset not found");
    }

    return asset;
  }
}

function toContractTaskStatus(status: string) {
  switch (status) {
    case "CREATED":
      return "created";
    case "QUEUED":
      return "queued";
    case "RUNNING":
      return "running";
    case "SUCCEEDED":
      return "succeeded";
    case "FAILED":
      return "failed";
    case "CANCELED":
      return "canceled";
    default:
      return "failed";
  }
}
