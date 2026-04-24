import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards
} from "@nestjs/common";
import type {
  BilibiliParseRequest,
  BilibiliParseResponse,
  BilibiliFavoritePreviewRequest,
  BilibiliFavoritePreviewResponse,
  ExperimentalPlaylistResponse,
  LocalAudioCacheRequest,
  LocalAudioCacheResponse,
  SourceContentCacheResponse
} from "@ai-music-playlist/api-contract";

import type { AlphaAccessTokenPayload } from "../auth/alpha-auth";
import { AlphaAuthGuard } from "../auth/alpha-auth.guard";
import { CurrentAlphaUser } from "../auth/current-alpha-user.decorator";
import { ContentsService } from "./contents.service";
import { parseHttpRange } from "./local-audio-cache";

@Controller("contents")
export class ContentsController {
  constructor(@Inject(ContentsService) private readonly contentsService: ContentsService) {
    this.parseBilibili = this.parseBilibili.bind(this);
    this.previewBilibiliFavorite = this.previewBilibiliFavorite.bind(this);
    this.excludeSourceCollectionItem = this.excludeSourceCollectionItem.bind(this);
    this.getBilibiliCover = this.getBilibiliCover.bind(this);
    this.cacheLocalAudio = this.cacheLocalAudio.bind(this);
    this.getExperimentalPlaylist = this.getExperimentalPlaylist.bind(this);
    this.getLocalAudio = this.getLocalAudio.bind(this);
    this.getLocalCover = this.getLocalCover.bind(this);
    this.deleteLocalAudio = this.deleteLocalAudio.bind(this);
    this.clearExperimentalPlaylist = this.clearExperimentalPlaylist.bind(this);
    this.removeExperimentalPlaylistItem = this.removeExperimentalPlaylistItem.bind(this);
    this.cacheSourceContent = this.cacheSourceContent.bind(this);
  }

  @Post("debug/parse-bilibili")
  parseBilibili(@Body() body: BilibiliParseRequest): Promise<BilibiliParseResponse> {
    return this.contentsService.parseBilibiliLink(body);
  }

  @Post("experimental/bilibili-favorite-preview")
  previewBilibiliFavorite(
    @Body() body: BilibiliFavoritePreviewRequest,
  ): Promise<BilibiliFavoritePreviewResponse> {
    return this.contentsService.previewBilibiliFavorite(body);
  }

  @Delete("experimental/source-collections/items/:collectionItemId")
  excludeSourceCollectionItem(@Param("collectionItemId") collectionItemId: string) {
    return this.contentsService.excludeSourceCollectionItem(collectionItemId);
  }

  @Get("debug/cover")
  async getBilibiliCover(
    @Query("url") url: string,
    @Res({ passthrough: true }) response: { setHeader: (name: string, value: string) => void },
  ) {
    const cover = await this.contentsService.fetchCoverImage(url);

    response.setHeader("content-type", cover.contentType);
    response.setHeader("cache-control", "public, max-age=3600");

    return new StreamableFile(cover.buffer);
  }

  @Post("experimental/local-audio")
  cacheLocalAudio(@Body() body: LocalAudioCacheRequest): Promise<LocalAudioCacheResponse> {
    return this.contentsService.cacheBilibiliAudio(body);
  }

  @Post(":sourceContentId/cache")
  @UseGuards(AlphaAuthGuard)
  cacheSourceContent(
    @CurrentAlphaUser() user: AlphaAccessTokenPayload,
    @Param("sourceContentId") sourceContentId: string,
  ): Promise<SourceContentCacheResponse> {
    return this.contentsService.cacheSourceContentForUser(user.userId, sourceContentId);
  }

  @Get("experimental/local-audio/playlist")
  getExperimentalPlaylist(): Promise<ExperimentalPlaylistResponse> {
    return this.contentsService.getExperimentalPlaylist();
  }

  @Get("experimental/local-audio/:cacheKey/audio")
  getLocalAudio(
    @Param("cacheKey") cacheKey: string,
    @Headers("range") rangeHeader: string | undefined,
    @Res({ passthrough: true })
    response: {
      setHeader: (name: string, value: string | number) => void;
      status: (code: number) => unknown;
    },
  ) {
    const audio = this.contentsService.getCachedLocalAudio(cacheKey);
    const parsedRange = parseHttpRange(rangeHeader, audio.totalSize);

    response.setHeader("content-type", audio.contentType);
    response.setHeader("cache-control", "private, max-age=3600");
    response.setHeader("accept-ranges", "bytes");

    if (parsedRange) {
      const rangedAudio = this.contentsService.getCachedLocalAudioRange(cacheKey, {
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

  @Get("experimental/local-audio/:cacheKey/cover")
  getLocalCover(
    @Param("cacheKey") cacheKey: string,
    @Res({ passthrough: true }) response: { setHeader: (name: string, value: string) => void },
  ) {
    const cover = this.contentsService.getCachedLocalCover(cacheKey);

    response.setHeader("content-type", cover.contentType);
    response.setHeader("cache-control", "private, max-age=3600");

    return new StreamableFile(cover.stream);
  }

  @Delete("experimental/local-audio/:cacheKey")
  deleteLocalAudio(@Param("cacheKey") cacheKey: string) {
    return this.contentsService.deleteCachedLocalAudio(cacheKey);
  }

  @Delete("experimental/local-audio/playlist")
  clearExperimentalPlaylist() {
    return this.contentsService.clearExperimentalPlaylist();
  }

  @Delete("experimental/local-audio/playlist/items/:playlistItemId")
  removeExperimentalPlaylistItem(@Param("playlistItemId") playlistItemId: string) {
    return this.contentsService.removeExperimentalPlaylistItem(playlistItemId);
  }
}
