import { Body, Controller, Get, Headers, Inject, NotFoundException, Param, Post, Res, StreamableFile, UseGuards } from "@nestjs/common";
import {
  localAudioCacheRequestCreateSchema,
  localAudioConfirmClientCacheRequestSchema,
  type LocalAudioCacheRequestCreateResponse,
  type LocalAudioConfirmClientCacheResponse,
  type LocalAudioTaskStatusResponse
} from "@ai-music-playlist/api-contract";

import { appEnv } from "../../config/env";
import type { AlphaAccessTokenPayload } from "../auth/alpha-auth";
import { AlphaAuthGuard } from "../auth/alpha-auth.guard";
import { CurrentAlphaUser } from "../auth/current-alpha-user.decorator";
import { LocalAudioCleanupService } from "./local-audio-cleanup.service";
import { parseHttpRange } from "./local-audio-cache";
import { LocalAudioService } from "./local-audio.service";

@Controller("local-audio")
@UseGuards(AlphaAuthGuard)
export class LocalAudioController {
  constructor(
    @Inject(LocalAudioService) private readonly localAudioService: LocalAudioService,
    @Inject(LocalAudioCleanupService) private readonly cleanupService: LocalAudioCleanupService,
  ) {}

  @Post("cache-requests")
  requestCache(
    @CurrentAlphaUser() user: AlphaAccessTokenPayload,
    @Body() body: unknown,
  ): Promise<LocalAudioCacheRequestCreateResponse> {
    return this.localAudioService.requestCache(user.userId, localAudioCacheRequestCreateSchema.parse(body));
  }

  @Get("tasks/:taskId")
  getTaskStatus(
    @CurrentAlphaUser() user: AlphaAccessTokenPayload,
    @Param("taskId") taskId: string,
  ): Promise<LocalAudioTaskStatusResponse> {
    return this.localAudioService.getTaskStatus(user.userId, taskId);
  }

  @Get("assets/:assetId/download")
  async downloadAsset(
    @CurrentAlphaUser() user: AlphaAccessTokenPayload,
    @Param("assetId") assetId: string,
    @Headers("range") rangeHeader: string | undefined,
    @Res({ passthrough: true })
    response: {
      setHeader: (name: string, value: string | number) => void;
      status: (code: number) => unknown;
    },
  ) {
    const audio = await this.localAudioService.getDownloadableAsset(user.userId, assetId);
    const parsedRange = parseHttpRange(rangeHeader, audio.totalSize);

    response.setHeader("content-type", audio.contentType);
    response.setHeader("cache-control", "private, no-store");
    response.setHeader("accept-ranges", "bytes");

    if (parsedRange?.kind === "invalid") {
      response.status(416);
      response.setHeader("content-range", parsedRange.contentRange);
      response.setHeader("content-length", 0);
      return undefined;
    }

    if (parsedRange?.kind === "range") {
      const rangedAudio = await this.localAudioService.getDownloadableAssetRange(user.userId, assetId, {
        start: parsedRange.start,
        end: parsedRange.end
      });

      response.status(206);
      response.setHeader("content-range", parsedRange.contentRange);
      response.setHeader("content-length", parsedRange.chunkSize);

      return new StreamableFile(rangedAudio.stream);
    }

    response.setHeader("content-length", audio.totalSize);
    return new StreamableFile(audio.stream);
  }

  @Post("assets/:assetId/confirm-client-cache")
  confirmClientCache(
    @CurrentAlphaUser() user: AlphaAccessTokenPayload,
    @Param("assetId") assetId: string,
    @Body() body: unknown,
  ): Promise<LocalAudioConfirmClientCacheResponse> {
    return this.localAudioService.confirmClientCache(
      user.userId,
      assetId,
      localAudioConfirmClientCacheRequestSchema.parse(body),
    );
  }

  @Post("internal/cleanup-expired")
  cleanupExpired() {
    if (!appEnv.ENABLE_DEBUG_ROUTES) {
      throw new NotFoundException("Debug routes are disabled");
    }

    return this.cleanupService.cleanupExpired();
  }
}
