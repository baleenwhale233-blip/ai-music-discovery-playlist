import { Controller, Get, Headers, Inject, Param, Res, StreamableFile, UseGuards } from "@nestjs/common";

import type { AlphaAccessTokenPayload } from "../auth/alpha-auth";
import { AlphaAuthGuard } from "../auth/alpha-auth.guard";
import { CurrentAlphaUser } from "../auth/current-alpha-user.decorator";
import { ContentsService } from "./contents.service";
import { parseHttpRange } from "./local-audio-cache";

@Controller("local-audio")
@UseGuards(AlphaAuthGuard)
export class LocalAudioController {
  constructor(@Inject(ContentsService) private readonly contentsService: ContentsService) {
    this.getAudio = this.getAudio.bind(this);
    this.getCover = this.getCover.bind(this);
  }

  @Get(":cacheKey/audio")
  async getAudio(
    @CurrentAlphaUser() user: AlphaAccessTokenPayload,
    @Param("cacheKey") cacheKey: string,
    @Headers("range") rangeHeader: string | undefined,
    @Res({ passthrough: true })
    response: {
      setHeader: (name: string, value: string | number) => void;
      status: (code: number) => unknown;
    },
  ) {
    const audio = await this.contentsService.getCachedLocalAudioForUser(user.userId, cacheKey);
    const parsedRange = parseHttpRange(rangeHeader, audio.totalSize);

    response.setHeader("content-type", audio.contentType);
    response.setHeader("cache-control", "private, max-age=3600");
    response.setHeader("accept-ranges", "bytes");

    if (parsedRange?.kind === "invalid") {
      response.status(416);
      response.setHeader("content-range", parsedRange.contentRange);
      response.setHeader("content-length", 0);

      return undefined;
    }

    if (parsedRange?.kind === "range") {
      const rangedAudio = await this.contentsService.getCachedLocalAudioRangeForUser(user.userId, cacheKey, {
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

  @Get(":cacheKey/cover")
  async getCover(
    @CurrentAlphaUser() user: AlphaAccessTokenPayload,
    @Param("cacheKey") cacheKey: string,
    @Res({ passthrough: true }) response: { setHeader: (name: string, value: string) => void },
  ) {
    const cover = await this.contentsService.getCachedLocalCoverForUser(user.userId, cacheKey);

    response.setHeader("content-type", cover.contentType);
    response.setHeader("cache-control", "private, max-age=3600");

    return new StreamableFile(cover.stream);
  }
}
