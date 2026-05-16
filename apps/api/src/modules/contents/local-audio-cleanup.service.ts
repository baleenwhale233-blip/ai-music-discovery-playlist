import { Injectable, Optional } from "@nestjs/common";

import { appEnv } from "../../config/env";
import { LocalAudioStagingStorageService } from "./local-audio-staging-storage.service";
import { LocalAudioTempStorageService } from "./local-audio-temp-storage.service";

type PrismaCleanupClient = {
  localAudioAsset: {
    findMany(input: {
      where: {
        storageType: string;
        status: string;
        serverArtifactExpiresAt: { lt: Date };
      };
    }): Promise<Array<{ id: string; relativeFilePath: string | null }>>;
    update(input: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
};

@Injectable()
export class LocalAudioCleanupService {
  constructor(
    private readonly prisma: PrismaCleanupClient,
    private readonly stagingStorage: LocalAudioStagingStorageService,
    private readonly tempStorage: LocalAudioTempStorageService,
    @Optional() options?: { tempTtlHours: number },
  ) {
    this.options = options ?? { tempTtlHours: appEnv.LOCAL_AUDIO_TEMP_TTL_HOURS };
  }

  private readonly options: { tempTtlHours: number };

  async cleanupExpired(now = new Date()) {
    const expiredAssets = await this.prisma.localAudioAsset.findMany({
      where: {
        storageType: "SELF_HOSTED_NODE",
        status: "READY",
        serverArtifactExpiresAt: {
          lt: now
        }
      }
    });
    let expiredArtifactsDeleted = 0;

    for (const asset of expiredAssets) {
      if (await this.stagingStorage.deleteRelativePath(asset.relativeFilePath)) {
        expiredArtifactsDeleted += 1;
      }

      await this.prisma.localAudioAsset.update({
        where: { id: asset.id },
        data: {
          status: "FAILED",
          storageType: "SELF_HOSTED_NODE",
          relativeFilePath: null,
          lastError: "Local audio staging artifact expired before client confirmation",
          serverDeletedAt: now
        }
      });
    }

    const staleBefore = new Date(now.getTime() - this.options.tempTtlHours * 60 * 60 * 1000);
    const staleTempDirsDeleted = await this.tempStorage.cleanupStaleTempDirs(staleBefore);

    return {
      expiredArtifactsDeleted,
      staleTempDirsDeleted
    };
  }
}
