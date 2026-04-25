import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { createReadStream, existsSync, rmSync, statSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import {
  bilibiliFavoritePreviewRequestSchema,
  bilibiliParseRequestSchema,
  type ExperimentalPlaylistResponse,
  importCacheRequestSchema,
  importItemsUpdateRequestSchema,
  importPreviewRequestSchema,
  localAudioCacheRequestSchema,
  type BilibiliFavoritePreviewRequest,
  type BilibiliFavoritePreviewResponse,
  type BilibiliParseRequest,
  type BilibiliParseResponse,
  type ImportCacheRequest,
  type ImportCacheResponse,
  type ImportItemsUpdateRequest,
  type ImportItemsUpdateResponse,
  type ImportPreviewRequest,
  type ImportPreviewResponse,
  type LocalAudioPlaylistResponse,
  type LocalAudioCacheRequest,
  type LocalAudioCacheResponse,
  type SourceContentCacheResponse
} from "@ai-music-playlist/api-contract";
import { appEnv } from "../../config/env";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { fetchBilibiliImportPreview } from "./bilibili-import-preview";
import { buildExperimentalPlaylistResponse } from "./experimental-playlist";
import { buildLocalAudioPlaylistResponse } from "./local-audio-playlist";

import { normalizeBilibiliCoverUrl } from "./bilibili-cover";
import { buildBilibiliFavoritePreviewResponse } from "./experimental-collection";
import {
  isResolvableBilibiliShortLink,
  parseBilibiliFavoriteLink,
  parseBilibiliLink
} from "./bilibili-link.parser";
import { LocalAudioConversionService } from "./local-audio-conversion.service";
import {
  buildFfmpegAudioExtractArgs,
  BILIBILI_DESKTOP_USER_AGENT,
  ensureAudioCacheDir,
  findCachedAudioFile,
  findCachedCoverFile,
  getLocalAudioCachePaths,
  isPathInsideRoot,
  listLocalAudioCacheKeys,
  readLocalAudioCacheMetadata,
  toSafeCacheKey,
  writeLocalAudioCacheMetadata
} from "./local-audio-cache";

type BilibiliViewResponse = {
  code: number;
  message: string;
  data?: {
    title?: string;
    pic?: string;
    duration?: number;
    owner?: {
      name?: string;
    };
    pages?: Array<{
      cid?: number;
      duration?: number;
      page?: number;
    }>;
  };
};

type BilibiliFavoriteResponse = {
  code: number;
  message: string;
  data?: {
    info?: {
      title?: string;
    };
    medias?: Array<{
      title?: string;
      bvid?: string;
      cover?: string;
      duration?: number;
      upper?: {
        name?: string;
      };
    }>;
  };
};

@Injectable()
export class ContentsService {
  private readonly localAudioCacheRoot = isAbsolute(appEnv.LOCAL_AUDIO_CACHE_DIR)
    ? appEnv.LOCAL_AUDIO_CACHE_DIR
    : join(process.cwd(), appEnv.LOCAL_AUDIO_CACHE_DIR);
  private readonly experimentalUserEmail = "local-audio-experiment@system.local";
  private readonly experimentalPlaylistName = "实验本地听单";
  private readonly localAudioPlaylistName = "我的本地听单";

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LocalAudioConversionService) private readonly localAudioConversion: LocalAudioConversionService,
  ) {}

  async previewImportForUser(
    userId: string,
    input: ImportPreviewRequest,
  ): Promise<ImportPreviewResponse> {
    const payload = importPreviewRequestSchema.parse(input);
    const preview = await fetchBilibiliImportPreview({
      url: payload.url,
      limit: payload.limit,
      fetchImpl: globalThis.fetch
    });
    const collection = await this.prisma.sourceCollection.upsert({
      where: {
        userId_platform_platformCollectionId: {
          userId,
          platform: "BILIBILI",
          platformCollectionId: preview.mediaId
        }
      },
      create: {
        userId,
        platform: "BILIBILI",
        collectionType: preview.sourceType === "collection" ? "PLAYLIST" : "FAVORITES",
        platformCollectionId: preview.mediaId,
        sourceUrl: payload.url,
        title: preview.title,
        itemCountSnapshot: preview.totalCount,
        lastSyncedAt: new Date()
      },
      update: {
        userId,
        sourceUrl: payload.url,
        title: preview.title,
        itemCountSnapshot: preview.totalCount,
        lastSyncedAt: new Date()
      }
    });

    const responseItems = [];

    for (const [index, item] of preview.items.entries()) {
      const sourceContent = await this.prisma.sourceContent.upsert({
        where: {
          platform_platformContentId: {
            platform: "BILIBILI",
            platformContentId: item.bvid
          }
        },
        create: {
          platform: "BILIBILI",
          platformContentId: item.bvid,
          canonicalUrl: item.url,
          title: item.title,
          coverUrl: item.coverUrl,
          authorNameSnapshot: item.ownerName,
          contentKind: "MUSIC_VIDEO",
          durationSec: item.durationSeconds,
          playableStatus: "PLAYABLE",
          importStatus: "READY"
        },
        update: {
          canonicalUrl: item.url,
          title: item.title,
          coverUrl: item.coverUrl,
          authorNameSnapshot: item.ownerName,
          durationSec: item.durationSeconds,
          playableStatus: "PLAYABLE",
          importStatus: "READY"
        }
      });
      const collectionItem = await this.prisma.sourceCollectionItem.upsert({
        where: {
          sourceCollectionId_sourceContentId: {
            sourceCollectionId: collection.id,
            sourceContentId: sourceContent.id
          }
        },
        create: {
          sourceCollectionId: collection.id,
          sourceContentId: sourceContent.id,
          position: index + 1,
          isExcluded: item.isExcluded
        },
        update: {
          position: index + 1,
          isExcluded: item.isExcluded
        }
      });
      const localAudioAsset = await this.prisma.localAudioAsset.findUnique({
        where: {
          userId_sourceContentId: {
            userId,
            sourceContentId: sourceContent.id
          }
        }
      });

      responseItems.push({
        id: collectionItem.id,
        sourceContentId: sourceContent.id,
        bvid: item.bvid,
        title: item.title,
        url: item.url,
        coverUrl: item.coverUrl,
        ownerName: item.ownerName,
        durationSeconds: item.durationSeconds,
        isExcluded: collectionItem.isExcluded,
        cacheStatus: this.mapLocalAudioAssetToImportStatus(localAudioAsset?.status ?? null)
      });
    }

    return {
      collectionId: collection.id,
      mediaId: preview.mediaId,
      title: preview.title,
      sourceType: preview.sourceType,
      totalCount: preview.totalCount,
      items: responseItems
    };
  }

  async updateImportItemsForUser(
    userId: string,
    collectionId: string,
    input: ImportItemsUpdateRequest,
  ): Promise<ImportItemsUpdateResponse> {
    const payload = importItemsUpdateRequestSchema.parse(input);
    const collection = await this.prisma.sourceCollection.findFirst({
      where: {
        id: collectionId,
        userId
      }
    });

    if (!collection) {
      throw new BadRequestException("Source collection not found");
    }

    if (payload.excludedItemIds.length > 0) {
      await this.prisma.sourceCollectionItem.updateMany({
        where: {
          sourceCollectionId: collection.id,
          id: {
            in: payload.excludedItemIds
          }
        },
        data: {
          isExcluded: true
        }
      });
    }

    return {
      collectionId,
      excludedItemIds: payload.excludedItemIds,
      updatedCount: payload.excludedItemIds.length
    };
  }

  async cacheImportItemsForUser(
    userId: string,
    collectionId: string,
    input: ImportCacheRequest,
  ): Promise<ImportCacheResponse> {
    const payload = importCacheRequestSchema.parse(input);
    const collection = await this.prisma.sourceCollection.findFirst({
      where: {
        id: collectionId,
        userId
      },
      include: {
        items: {
          include: {
            sourceContent: true
          },
          orderBy: {
            position: "asc"
          }
        }
      }
    });

    if (!collection) {
      throw new BadRequestException("Source collection not found");
    }

    const itemIdSet = payload.itemIds ? new Set(payload.itemIds) : null;
    const sourceContentIdSet = payload.sourceContentIds ? new Set(payload.sourceContentIds) : null;
    const selectedItems = collection.items.filter((item) => {
      if (item.isExcluded) {
        return false;
      }

      if (itemIdSet && !itemIdSet.has(item.id)) {
        return false;
      }

      if (sourceContentIdSet && !sourceContentIdSet.has(item.sourceContentId)) {
        return false;
      }

      return true;
    });
    const playlistItemIds: string[] = [];
    let cachedCount = 0;
    let failedCount = 0;

    for (const item of selectedItems) {
      try {
        const result = await this.cacheBilibiliAudioForUser(userId, {
          url: item.sourceContent.canonicalUrl
        });
        playlistItemIds.push(result.playlistItemId);
        cachedCount += 1;
      } catch {
        failedCount += 1;
      }
    }

    return {
      collectionId,
      cachedCount,
      failedCount,
      playlistItemIds
    };
  }

  async cacheSourceContentForUser(
    userId: string,
    sourceContentId: string,
  ): Promise<SourceContentCacheResponse> {
    const sourceContent = await this.prisma.sourceContent.findUnique({
      where: {
        id: sourceContentId
      }
    });

    if (!sourceContent) {
      throw new BadRequestException("Source content not found");
    }

    const result = await this.cacheBilibiliAudioForUser(userId, {
      url: sourceContent.canonicalUrl
    });

    return {
      sourceContentId: result.sourceContentId,
      cacheKey: result.cacheKey,
      audioUrl: result.audioUrl,
      coverUrl: result.coverUrl,
      status: result.status,
      message: result.message
    };
  }

  async getLocalAudioPlaylistForUser(userId: string): Promise<LocalAudioPlaylistResponse> {
    const playlist = await this.ensureLocalAudioPlaylist(userId);
    const playlistWithItems = await this.prisma.playlist.findUniqueOrThrow({
      where: {
        id: playlist.id
      },
      include: {
        items: {
          include: {
            sourceContent: true,
            localAudioAsset: true
          }
        }
      }
    });

    return buildLocalAudioPlaylistResponse({
      playlist: {
        id: playlistWithItems.id,
        name: playlistWithItems.name,
        kind: playlistWithItems.kind,
        sourceType: playlistWithItems.sourceType
      },
      items: playlistWithItems.items
    });
  }

  async removeLocalAudioPlaylistItemForUser(userId: string, playlistItemId: string) {
    const item = await this.prisma.playlistItem.findFirst({
      where: {
        id: playlistItemId,
        playlist: {
          userId
        }
      }
    });

    if (!item) {
      throw new BadRequestException("Playlist item not found");
    }

    await this.prisma.playlistItem.delete({
      where: {
        id: item.id
      }
    });
    await this.refreshPlaylistCounts(item.playlistId);

    return {
      id: playlistItemId,
      deleted: true
    };
  }

  async clearLocalAudioPlaylistForUser(userId: string) {
    const playlist = await this.ensureLocalAudioPlaylist(userId);
    const playlistWithItems = await this.prisma.playlist.findUniqueOrThrow({
      where: {
        id: playlist.id
      },
      include: {
        items: {
          include: {
            localAudioAsset: true
          }
        }
      }
    });

    for (const item of playlistWithItems.items) {
      if (item.localAudioAsset?.cacheKey) {
        await this.deleteCachedLocalAudioForUser(userId, item.localAudioAsset.cacheKey);
      }
    }

    await this.prisma.playlistItem.deleteMany({
      where: {
        playlistId: playlist.id
      }
    });
    await this.refreshPlaylistCounts(playlist.id);

    return {
      deleted: true
    };
  }

  async parseBilibiliLink(input: BilibiliParseRequest): Promise<BilibiliParseResponse> {
    const payload = bilibiliParseRequestSchema.parse(input);
    const resolved = await this.resolveInput(payload.url);
    const videoData = await this.fetchVideoMeta(resolved.bvid);
    const pageData = videoData.pages?.[resolved.page - 1] ?? videoData.pages?.[0];
    const cid = pageData?.cid;

    if (!cid) {
      throw new BadRequestException("Unable to resolve bilibili cid");
    }

    return {
      sourceUrl: payload.url,
      normalizedUrl: resolved.normalizedUrl,
      bvid: resolved.bvid,
      cid,
      page: resolved.page,
      title: videoData.title ?? resolved.bvid,
      coverUrl: normalizeBilibiliCoverUrl(videoData.pic),
      ownerName: videoData.owner?.name ?? null,
      durationSeconds: pageData?.duration ?? videoData.duration ?? null,
      embedUrl: this.buildEmbedUrl({
        bvid: resolved.bvid,
        cid,
        page: resolved.page
      })
    };
  }

  private async resolveInput(rawInput: string) {
    try {
      return parseBilibiliLink(rawInput);
    } catch (error) {
      if (!isResolvableBilibiliShortLink(rawInput)) {
        throw error;
      }
    }

    const response = await fetch(rawInput, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      }
    });

    return parseBilibiliLink(response.url);
  }

  private async fetchVideoMeta(bvid: string) {
    const response = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        referer: `https://www.bilibili.com/video/${bvid}`
      }
    });

    if (!response.ok) {
      throw new BadRequestException(`Bilibili meta request failed with ${response.status}`);
    }

    const payload = (await response.json()) as BilibiliViewResponse;

    if (payload.code !== 0 || !payload.data) {
      throw new BadRequestException(payload.message || "Unable to load bilibili video info");
    }

    return payload.data;
  }

  private buildEmbedUrl(input: { bvid: string; cid: number; page: number }) {
    const params = new URLSearchParams({
      bvid: input.bvid,
      cid: String(input.cid),
      p: String(input.page),
      autoplay: "0",
      danmaku: "0",
      poster: "1"
    });

    return `https://player.bilibili.com/player.html?${params.toString()}`;
  }

  async fetchCoverImage(url: string) {
    const sourceUrl = normalizeBilibiliCoverUrl(url);

    if (!sourceUrl) {
      throw new BadRequestException("Missing bilibili cover url");
    }

    const response = await fetch(sourceUrl, {
      headers: {
        "user-agent": BILIBILI_DESKTOP_USER_AGENT,
        referer: "https://www.bilibili.com/"
      }
    });

    if (!response.ok) {
      throw new BadRequestException(`Bilibili cover request failed with ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();

    return {
      buffer: Buffer.from(arrayBuffer),
      contentType
    };
  }

  async cacheBilibiliAudio(input: LocalAudioCacheRequest): Promise<LocalAudioCacheResponse> {
    this.localAudioConversion.assertExecutableAvailable("ffmpeg");

    const payload = localAudioCacheRequestSchema.parse(input);
    const parsed = await this.parseBilibiliLink({ url: payload.url });
    const cacheKey = toSafeCacheKey(parsed.bvid);
    const paths = getLocalAudioCachePaths({
      cacheRoot: this.localAudioCacheRoot,
      cacheKey
    });

    ensureAudioCacheDir(paths.itemDir);

    let audioFile = findCachedAudioFile(paths.itemDir);
    let cached = true;

    if (!audioFile) {
      cached = false;
      const playUrl = await this.localAudioConversion.fetchBilibiliMobilePlayableUrl({
        bvid: parsed.bvid,
        page: parsed.page
      });
      await this.localAudioConversion.runFfmpeg(buildFfmpegAudioExtractArgs({
        sourceUrl: playUrl,
        outputAudioPath: paths.outputAudioPath
      }));
      audioFile = findCachedAudioFile(paths.itemDir);
    }

    if (!audioFile) {
      throw new BadRequestException("yt-dlp finished but no local audio file was found");
    }

    const coverFile = findCachedCoverFile(paths.itemDir);
    writeLocalAudioCacheMetadata({
      metadataPath: paths.metadataPath,
      metadata: {
        cacheKey,
        sourceUrl: parsed.sourceUrl,
        normalizedUrl: parsed.normalizedUrl,
        title: parsed.title,
        bvid: parsed.bvid,
        coverUrl: parsed.coverUrl,
        durationSeconds: parsed.durationSeconds,
        createdAt: new Date().toISOString()
      }
    });

    try {
      const user = await this.ensureExperimentalUser();
      const sourceContent = await this.prisma.sourceContent.upsert({
        where: {
          platform_platformContentId: {
            platform: "BILIBILI",
            platformContentId: parsed.bvid
          }
        },
        create: {
          platform: "BILIBILI",
          platformContentId: parsed.bvid,
          canonicalUrl: parsed.normalizedUrl,
          title: parsed.title,
          coverUrl: parsed.coverUrl,
          authorNameSnapshot: parsed.ownerName,
          contentKind: "MUSIC_VIDEO",
          durationSec: parsed.durationSeconds,
          playableStatus: "PLAYABLE",
          importStatus: "READY"
        },
        update: {
          canonicalUrl: parsed.normalizedUrl,
          title: parsed.title,
          coverUrl: parsed.coverUrl,
          authorNameSnapshot: parsed.ownerName,
          durationSec: parsed.durationSeconds,
          playableStatus: "PLAYABLE",
          importStatus: "READY"
        }
      });
      const localAudioAsset = await this.prisma.localAudioAsset.upsert({
        where: {
          userId_sourceContentId: {
            userId: user.id,
            sourceContentId: sourceContent.id
          }
        },
        create: {
          userId: user.id,
          sourceContentId: sourceContent.id,
          cacheKey,
          storageType: "SELF_HOSTED_NODE",
          relativeFilePath: audioFile ? this.getRelativeCacheFilePath(paths.root, audioFile) : null,
          coverRelativePath:
            coverFile && isPathInsideRoot(paths.root, coverFile)
              ? this.getRelativeCacheFilePath(paths.root, coverFile)
              : null,
          mimeType: this.getAudioContentType(audioFile),
          fileSizeBytes: statSync(audioFile).size,
          durationSec: parsed.durationSeconds,
          status: "READY",
          lastAccessedAt: new Date()
        },
        update: {
          cacheKey,
          storageType: "SELF_HOSTED_NODE",
          relativeFilePath: audioFile ? this.getRelativeCacheFilePath(paths.root, audioFile) : null,
          coverRelativePath:
            coverFile && isPathInsideRoot(paths.root, coverFile)
              ? this.getRelativeCacheFilePath(paths.root, coverFile)
              : null,
          mimeType: this.getAudioContentType(audioFile),
          fileSizeBytes: statSync(audioFile).size,
          durationSec: parsed.durationSeconds,
          status: "READY",
          lastError: null,
          deletedAt: null,
          lastAccessedAt: new Date()
        }
      });
      await this.prisma.conversionTask.create({
        data: {
          userId: user.id,
          sourceContentId: sourceContent.id,
          localAudioAssetId: localAudioAsset.id,
          taskType: "CACHE_AUDIO",
          status: "SUCCEEDED",
          runnerType: "SELF_HOSTED_NODE",
          runnerLabel: "local-audio-experiment",
          attempts: 1,
          priority: 100,
          payloadJson: {
            sourceUrl: parsed.sourceUrl,
            cacheKey
          },
          startedAt: new Date(),
          finishedAt: new Date()
        }
      });
      const playlist = await this.ensureExperimentalPlaylist(user.id);
      const nextPosition = await this.getNextPlaylistPosition(playlist.id);
      await this.prisma.playlistItem.upsert({
        where: {
          playlistId_sourceContentId: {
            playlistId: playlist.id,
            sourceContentId: sourceContent.id
          }
        },
        create: {
          playlistId: playlist.id,
          sourceContentId: sourceContent.id,
          localAudioAssetId: localAudioAsset.id,
          position: nextPosition,
          titleSnapshot: parsed.title,
          coverUrlSnapshot: parsed.coverUrl,
          durationSecSnapshot: parsed.durationSeconds,
          addedByUserId: user.id
        },
        update: {
          localAudioAssetId: localAudioAsset.id,
          titleSnapshot: parsed.title,
          coverUrlSnapshot: parsed.coverUrl,
          durationSecSnapshot: parsed.durationSeconds
        }
      });
      await this.refreshPlaylistCounts(playlist.id);
    } catch (error) {
      if (!this.isPrismaUnavailable(error)) {
        throw error;
      }
    }

    return {
      cacheKey,
      sourceUrl: parsed.sourceUrl,
      normalizedUrl: parsed.normalizedUrl,
      title: parsed.title,
      bvid: parsed.bvid,
      audioUrl: `/api/v1/contents/experimental/local-audio/${cacheKey}/audio`,
      coverUrl: coverFile ? `/api/v1/contents/experimental/local-audio/${cacheKey}/cover` : parsed.coverUrl,
      durationSeconds: parsed.durationSeconds,
      cached,
      message: cached ? "已找到本地音频缓存。" : "已生成本地音频缓存。"
    };
  }

  async previewBilibiliFavorite(
    input: BilibiliFavoritePreviewRequest,
  ): Promise<BilibiliFavoritePreviewResponse> {
    const user = await this.ensureExperimentalUser();
    const payload = bilibiliFavoritePreviewRequestSchema.parse(input);
    const parsed = parseBilibiliFavoriteLink(payload.url);
    const query = new URLSearchParams({
      media_id: parsed.mediaId,
      pn: "1",
      ps: String(payload.limit)
    });
    const response = await fetch(`https://api.bilibili.com/x/v3/fav/resource/list?${query.toString()}`, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        referer: "https://www.bilibili.com/"
      }
    });

    if (!response.ok) {
      throw new BadRequestException(`Bilibili favorite request failed with ${response.status}`);
    }

    const payloadJson = (await response.json()) as BilibiliFavoriteResponse;

    if (payloadJson.code !== 0 || !payloadJson.data) {
      throw new BadRequestException(payloadJson.message || "Unable to load bilibili favorite list");
    }

    const collection = await this.prisma.sourceCollection.upsert({
      where: {
        userId_platform_platformCollectionId: {
          userId: user.id,
          platform: "BILIBILI",
          platformCollectionId: parsed.mediaId
        }
      },
      create: {
        userId: user.id,
        platform: "BILIBILI",
        collectionType: "FAVORITES",
        platformCollectionId: parsed.mediaId,
        sourceUrl: payload.url,
        title: payloadJson.data.info?.title ?? null,
        itemCountSnapshot: (payloadJson.data.medias ?? []).length,
        lastSyncedAt: new Date()
      },
      update: {
        sourceUrl: payload.url,
        title: payloadJson.data.info?.title ?? null,
        itemCountSnapshot: (payloadJson.data.medias ?? []).length,
        lastSyncedAt: new Date()
      }
    });

    for (const [index, item] of (payloadJson.data.medias ?? []).entries()) {
      if (!item.bvid) {
        continue;
      }

      const sourceContent = await this.prisma.sourceContent.upsert({
        where: {
          platform_platformContentId: {
            platform: "BILIBILI",
            platformContentId: item.bvid
          }
        },
        create: {
          platform: "BILIBILI",
          platformContentId: item.bvid,
          canonicalUrl: `https://www.bilibili.com/video/${item.bvid}`,
          title: item.title ?? item.bvid,
          coverUrl: normalizeBilibiliCoverUrl(item.cover),
          authorNameSnapshot: item.upper?.name ?? null,
          contentKind: "MUSIC_VIDEO",
          durationSec: item.duration ?? null,
          playableStatus: "PLAYABLE",
          importStatus: "READY"
        },
        update: {
          canonicalUrl: `https://www.bilibili.com/video/${item.bvid}`,
          title: item.title ?? item.bvid,
          coverUrl: normalizeBilibiliCoverUrl(item.cover),
          authorNameSnapshot: item.upper?.name ?? null,
          durationSec: item.duration ?? null,
          playableStatus: "PLAYABLE",
          importStatus: "READY"
        }
      });

      await this.prisma.sourceCollectionItem.upsert({
        where: {
          sourceCollectionId_sourceContentId: {
            sourceCollectionId: collection.id,
            sourceContentId: sourceContent.id
          }
        },
        create: {
          sourceCollectionId: collection.id,
          sourceContentId: sourceContent.id,
          position: index + 1
        },
        update: {
          position: index + 1
        }
      });
    }

    const collectionWithItems = await this.prisma.sourceCollection.findUniqueOrThrow({
      where: {
        id: collection.id
      },
      include: {
        items: {
          include: {
            sourceContent: true
          }
        }
      }
    });

    return buildBilibiliFavoritePreviewResponse({
      collection: {
        id: collectionWithItems.id,
        platformCollectionId: collectionWithItems.platformCollectionId,
        title: collectionWithItems.title
      },
      items: collectionWithItems.items
    });
  }

  async excludeSourceCollectionItem(collectionItemId: string) {
    const item = await this.prisma.sourceCollectionItem.findUnique({
      where: { id: collectionItemId }
    });

    if (!item) {
      throw new BadRequestException("Source collection item not found");
    }

    await this.prisma.sourceCollectionItem.update({
      where: { id: collectionItemId },
      data: {
        isExcluded: true
      }
    });

    return {
      id: collectionItemId,
      excluded: true
    };
  }

  getCachedLocalAudio(cacheKey: string) {
    const paths = getLocalAudioCachePaths({
      cacheRoot: this.localAudioCacheRoot,
      cacheKey
    });
    const audioFile = findCachedAudioFile(paths.itemDir);

    if (!audioFile || !existsSync(audioFile)) {
      throw new BadRequestException("Local audio cache not found");
    }

    return {
      filePath: audioFile,
      stream: createReadStream(audioFile),
      contentType: this.getAudioContentType(audioFile),
      totalSize: statSync(audioFile).size
    };
  }

  getCachedLocalAudioRange(cacheKey: string, range: { start: number; end: number }) {
    const audio = this.getCachedLocalAudio(cacheKey);

    return {
      ...audio,
      stream: createReadStream(audio.filePath, {
        start: range.start,
        end: range.end
      })
    };
  }

  getCachedLocalCover(cacheKey: string) {
    const paths = getLocalAudioCachePaths({
      cacheRoot: this.localAudioCacheRoot,
      cacheKey
    });
    const coverFile = findCachedCoverFile(paths.itemDir);

    if (!coverFile || !existsSync(coverFile)) {
      throw new BadRequestException("Local cover cache not found");
    }

    return {
      stream: createReadStream(coverFile),
      contentType: this.getCoverContentType(coverFile)
    };
  }

  async deleteCachedLocalAudio(cacheKey: string) {
    const paths = getLocalAudioCachePaths({
      cacheRoot: this.localAudioCacheRoot,
      cacheKey
    });

    if (existsSync(paths.itemDir)) {
      rmSync(paths.itemDir, { recursive: true, force: true });
    }

    try {
      await this.prisma.localAudioAsset.updateMany({
        where: {
          cacheKey
        },
        data: {
          status: "DELETED",
          deletedAt: new Date()
        }
      });
    } catch (error) {
      if (!this.isPrismaUnavailable(error)) {
        throw error;
      }
    }

    return {
      cacheKey,
      deleted: true
    };
  }

  async getExperimentalPlaylist(): Promise<ExperimentalPlaylistResponse> {
    try {
      const user = await this.ensureExperimentalUser();
      const playlist = await this.ensureExperimentalPlaylist(user.id);
      const playlistWithItems = await this.prisma.playlist.findUniqueOrThrow({
        where: { id: playlist.id },
        include: {
          items: {
            include: {
              sourceContent: true,
              localAudioAsset: true
            }
          }
        }
      });

      return buildExperimentalPlaylistResponse({
        playlist: {
          id: playlistWithItems.id,
          name: playlistWithItems.name,
          kind: playlistWithItems.kind,
          sourceType: playlistWithItems.sourceType
        },
        items: playlistWithItems.items
      });
    } catch (error) {
      if (!this.isPrismaUnavailable(error)) {
        throw error;
      }

      return this.getExperimentalPlaylistFromLocalCache();
    }
  }

  async removeExperimentalPlaylistItem(playlistItemId: string) {
    try {
      const item = await this.prisma.playlistItem.findUnique({
        where: { id: playlistItemId }
      });

      if (!item) {
        throw new BadRequestException("Playlist item not found");
      }

      await this.prisma.playlistItem.delete({
        where: { id: playlistItemId }
      });

      await this.refreshPlaylistCounts(item.playlistId);

      return {
        id: playlistItemId,
        deleted: true
      };
    } catch (error) {
      if (!this.isPrismaUnavailable(error)) {
        throw error;
      }

      return this.deleteCachedLocalAudio(playlistItemId);
    }
  }

  async clearExperimentalPlaylist() {
    try {
      const user = await this.ensureExperimentalUser();
      const playlist = await this.prisma.playlist.findFirst({
        where: {
          userId: user.id,
          name: this.experimentalPlaylistName
        },
        include: {
          items: {
            include: {
              localAudioAsset: true
            }
          }
        }
      });

      if (!playlist) {
        return {
          deleted: true
        };
      }

      for (const item of playlist.items) {
        if (item.localAudioAsset?.cacheKey) {
          this.deleteCachedLocalAudio(item.localAudioAsset.cacheKey);
        }
      }

      await this.prisma.playlistItem.deleteMany({
        where: {
          playlistId: playlist.id
        }
      });
      await this.prisma.localAudioAsset.updateMany({
        where: {
          userId: user.id
        },
        data: {
          status: "DELETED",
          deletedAt: new Date()
        }
      });
      await this.refreshPlaylistCounts(playlist.id);

      return {
        deleted: true
      };
    } catch (error) {
      if (!this.isPrismaUnavailable(error)) {
        throw error;
      }

      for (const cacheKey of listLocalAudioCacheKeys(this.localAudioCacheRoot)) {
        const paths = getLocalAudioCachePaths({
          cacheRoot: this.localAudioCacheRoot,
          cacheKey
        });

        if (existsSync(paths.itemDir)) {
          rmSync(paths.itemDir, { recursive: true, force: true });
        }
      }

      return {
        deleted: true
      };
    }
  }

  async getCachedLocalAudioForUser(userId: string, cacheKey: string) {
    await this.assertLocalAudioAssetOwnedByUser(userId, cacheKey);
    const paths = getLocalAudioCachePaths({
      cacheRoot: this.getUserCacheRoot(userId),
      cacheKey
    });
    const audioFile = findCachedAudioFile(paths.itemDir);

    if (!audioFile || !existsSync(audioFile)) {
      throw new BadRequestException("Local audio cache not found");
    }

    return {
      filePath: audioFile,
      stream: createReadStream(audioFile),
      contentType: this.getAudioContentType(audioFile),
      totalSize: statSync(audioFile).size
    };
  }

  async getCachedLocalAudioRangeForUser(userId: string, cacheKey: string, range: { start: number; end: number }) {
    const audio = await this.getCachedLocalAudioForUser(userId, cacheKey);

    return {
      ...audio,
      stream: createReadStream(audio.filePath, {
        start: range.start,
        end: range.end
      })
    };
  }

  async getCachedLocalCoverForUser(userId: string, cacheKey: string) {
    await this.assertLocalAudioAssetOwnedByUser(userId, cacheKey);
    const paths = getLocalAudioCachePaths({
      cacheRoot: this.getUserCacheRoot(userId),
      cacheKey
    });
    const coverFile = findCachedCoverFile(paths.itemDir);

    if (!coverFile || !existsSync(coverFile)) {
      throw new BadRequestException("Local cover cache not found");
    }

    return {
      stream: createReadStream(coverFile),
      contentType: this.getCoverContentType(coverFile)
    };
  }

  private async cacheBilibiliAudioForUser(userId: string, input: LocalAudioCacheRequest) {
    this.localAudioConversion.assertExecutableAvailable("ffmpeg");

    const payload = localAudioCacheRequestSchema.parse(input);
    const parsed = await this.parseBilibiliLink({ url: payload.url });
    const cacheKey = toSafeCacheKey(`${userId}_${parsed.bvid}`);
    const paths = getLocalAudioCachePaths({
      cacheRoot: this.getUserCacheRoot(userId),
      cacheKey
    });

    ensureAudioCacheDir(paths.itemDir);

    let audioFile = findCachedAudioFile(paths.itemDir);
    let cached = true;

    if (!audioFile) {
      cached = false;
      const playUrl = await this.localAudioConversion.fetchBilibiliMobilePlayableUrl({
        bvid: parsed.bvid,
        page: parsed.page
      });
      await this.localAudioConversion.runFfmpeg(buildFfmpegAudioExtractArgs({
        sourceUrl: playUrl,
        outputAudioPath: paths.outputAudioPath
      }));
      audioFile = findCachedAudioFile(paths.itemDir);
    }

    if (!audioFile) {
      throw new BadRequestException("ffmpeg finished but no local audio file was found");
    }

    const coverFile = findCachedCoverFile(paths.itemDir);
    writeLocalAudioCacheMetadata({
      metadataPath: paths.metadataPath,
      metadata: {
        cacheKey,
        sourceUrl: parsed.sourceUrl,
        normalizedUrl: parsed.normalizedUrl,
        title: parsed.title,
        bvid: parsed.bvid,
        coverUrl: parsed.coverUrl,
        durationSeconds: parsed.durationSeconds,
        createdAt: new Date().toISOString()
      }
    });

    const sourceContent = await this.prisma.sourceContent.upsert({
      where: {
        platform_platformContentId: {
          platform: "BILIBILI",
          platformContentId: parsed.bvid
        }
      },
      create: {
        platform: "BILIBILI",
        platformContentId: parsed.bvid,
        canonicalUrl: parsed.normalizedUrl,
        title: parsed.title,
        coverUrl: parsed.coverUrl,
        authorNameSnapshot: parsed.ownerName,
        contentKind: "MUSIC_VIDEO",
        durationSec: parsed.durationSeconds,
        playableStatus: "PLAYABLE",
        importStatus: "READY"
      },
      update: {
        canonicalUrl: parsed.normalizedUrl,
        title: parsed.title,
        coverUrl: parsed.coverUrl,
        authorNameSnapshot: parsed.ownerName,
        durationSec: parsed.durationSeconds,
        playableStatus: "PLAYABLE",
        importStatus: "READY"
      }
    });
    const localAudioAsset = await this.prisma.localAudioAsset.upsert({
      where: {
        userId_sourceContentId: {
          userId,
          sourceContentId: sourceContent.id
        }
      },
      create: {
        userId,
        sourceContentId: sourceContent.id,
        cacheKey,
        storageType: "SELF_HOSTED_NODE",
        relativeFilePath: this.getRelativeCacheFilePath(this.localAudioCacheRoot, audioFile),
        coverRelativePath:
          coverFile && isPathInsideRoot(this.localAudioCacheRoot, coverFile)
            ? this.getRelativeCacheFilePath(this.localAudioCacheRoot, coverFile)
            : null,
        mimeType: this.getAudioContentType(audioFile),
        fileSizeBytes: statSync(audioFile).size,
        durationSec: parsed.durationSeconds,
        status: "READY",
        lastAccessedAt: new Date()
      },
      update: {
        cacheKey,
        storageType: "SELF_HOSTED_NODE",
        relativeFilePath: this.getRelativeCacheFilePath(this.localAudioCacheRoot, audioFile),
        coverRelativePath:
          coverFile && isPathInsideRoot(this.localAudioCacheRoot, coverFile)
            ? this.getRelativeCacheFilePath(this.localAudioCacheRoot, coverFile)
            : null,
        mimeType: this.getAudioContentType(audioFile),
        fileSizeBytes: statSync(audioFile).size,
        durationSec: parsed.durationSeconds,
        status: "READY",
        lastError: null,
        deletedAt: null,
        lastAccessedAt: new Date()
      }
    });

    await this.prisma.conversionTask.create({
      data: {
        userId,
        sourceContentId: sourceContent.id,
        localAudioAssetId: localAudioAsset.id,
        taskType: "CACHE_AUDIO",
        status: "SUCCEEDED",
        runnerType: "SELF_HOSTED_NODE",
        runnerLabel: "api-local-audio-alpha",
        attempts: 1,
        priority: 100,
        payloadJson: {
          sourceUrl: parsed.sourceUrl,
          cacheKey
        },
        startedAt: new Date(),
        finishedAt: new Date()
      }
    });

    const playlist = await this.ensureLocalAudioPlaylist(userId);
    const nextPosition = await this.getNextPlaylistPosition(playlist.id);
    const playlistItem = await this.prisma.playlistItem.upsert({
      where: {
        playlistId_sourceContentId: {
          playlistId: playlist.id,
          sourceContentId: sourceContent.id
        }
      },
      create: {
        playlistId: playlist.id,
        sourceContentId: sourceContent.id,
        localAudioAssetId: localAudioAsset.id,
        position: nextPosition,
        titleSnapshot: parsed.title,
        coverUrlSnapshot: parsed.coverUrl,
        durationSecSnapshot: parsed.durationSeconds,
        addedByUserId: userId
      },
      update: {
        localAudioAssetId: localAudioAsset.id,
        titleSnapshot: parsed.title,
        coverUrlSnapshot: parsed.coverUrl,
        durationSecSnapshot: parsed.durationSeconds
      }
    });
    await this.refreshPlaylistCounts(playlist.id);

    return {
      sourceContentId: sourceContent.id,
      playlistItemId: playlistItem.id,
      cacheKey,
      audioUrl: `/api/v1/local-audio/${encodeURIComponent(cacheKey)}/audio`,
      coverUrl: coverFile ? `/api/v1/local-audio/${encodeURIComponent(cacheKey)}/cover` : parsed.coverUrl,
      status: "ready" as const,
      message: cached ? "已找到本地音频缓存。" : "已生成本地音频缓存。"
    };
  }

  private async deleteCachedLocalAudioForUser(userId: string, cacheKey: string) {
    await this.assertLocalAudioAssetOwnedByUser(userId, cacheKey);
    const paths = getLocalAudioCachePaths({
      cacheRoot: this.getUserCacheRoot(userId),
      cacheKey
    });

    if (existsSync(paths.itemDir)) {
      rmSync(paths.itemDir, { recursive: true, force: true });
    }

    await this.prisma.localAudioAsset.updateMany({
      where: {
        userId,
        cacheKey
      },
      data: {
        status: "DELETED",
        deletedAt: new Date()
      }
    });

    return {
      cacheKey,
      deleted: true
    };
  }

  private async assertLocalAudioAssetOwnedByUser(userId: string, cacheKey: string) {
    const asset = await this.prisma.localAudioAsset.findFirst({
      where: {
        userId,
        cacheKey,
        status: {
          not: "DELETED"
        }
      }
    });

    if (!asset) {
      throw new BadRequestException("Local audio cache not found");
    }
  }

  private getUserCacheRoot(userId: string) {
    return join(this.localAudioCacheRoot, toSafeCacheKey(userId));
  }

  private mapLocalAudioAssetToImportStatus(status: string | null) {
    switch (status) {
      case "READY":
        return "cached" as const;
      case "PENDING":
      case "CACHING":
        return "caching" as const;
      case "FAILED":
        return "failed" as const;
      default:
        return "uncached" as const;
    }
  }

  private getExperimentalPlaylistFromLocalCache(): ExperimentalPlaylistResponse {
    const items = listLocalAudioCacheKeys(this.localAudioCacheRoot)
      .map((cacheKey, index) => {
        const paths = getLocalAudioCachePaths({
          cacheRoot: this.localAudioCacheRoot,
          cacheKey
        });
        const metadata = readLocalAudioCacheMetadata(paths.metadataPath);
        const audioFile = findCachedAudioFile(paths.itemDir);
        const coverFile = findCachedCoverFile(paths.itemDir);

        return {
          id: cacheKey,
          sourceContentId: cacheKey,
          localAudioAssetId: null,
          position: index + 1,
          title: metadata?.title ?? cacheKey,
          coverUrl: coverFile ? `/api/v1/contents/experimental/local-audio/${cacheKey}/cover` : metadata?.coverUrl ?? null,
          durationSeconds: metadata?.durationSeconds ?? null,
          audioUrl: audioFile ? `/api/v1/contents/experimental/local-audio/${cacheKey}/audio` : null,
          cacheKey,
          status: (audioFile ? "ready" : "failed") as "ready" | "failed"
        };
      })
      .filter((item) => item.audioUrl);

    return {
      playlist: {
        id: "local-cache-fallback",
        name: this.experimentalPlaylistName,
        kind: "music",
        sourceType: "manual",
        itemCount: items.length,
        cachedItemCount: items.filter((item) => item.status === "ready").length
      },
      items
    };
  }

  private async ensureExperimentalUser() {
    return this.prisma.user.upsert({
      where: {
        phoneOrEmail: this.experimentalUserEmail
      },
      create: {
        phoneOrEmail: this.experimentalUserEmail,
        nickname: "本地音频实验用户",
        status: "ACTIVE"
      },
      update: {}
    });
  }

  private async ensureExperimentalPlaylist(userId: string) {
    const existing = await this.prisma.playlist.findFirst({
      where: {
        userId,
        name: this.experimentalPlaylistName
      }
    });

    if (existing) {
      return existing;
    }

    return this.prisma.playlist.create({
      data: {
        userId,
        name: this.experimentalPlaylistName,
        visibility: "PRIVATE",
        kind: "MUSIC",
        sourceType: "MANUAL",
        itemCount: 0,
        cachedItemCount: 0
      }
    });
  }

  private async ensureLocalAudioPlaylist(userId: string) {
    const existing = await this.prisma.playlist.findFirst({
      where: {
        userId,
        name: this.localAudioPlaylistName
      }
    });

    if (existing) {
      return existing;
    }

    return this.prisma.playlist.create({
      data: {
        userId,
        name: this.localAudioPlaylistName,
        visibility: "PRIVATE",
        kind: "MUSIC",
        sourceType: "MANUAL",
        itemCount: 0,
        cachedItemCount: 0
      }
    });
  }

  private async getNextPlaylistPosition(playlistId: string) {
    const lastItem = await this.prisma.playlistItem.findFirst({
      where: { playlistId },
      orderBy: {
        position: "desc"
      }
    });

    return (lastItem?.position ?? 0) + 1;
  }

  private async refreshPlaylistCounts(playlistId: string) {
    const items = await this.prisma.playlistItem.findMany({
      where: { playlistId },
      include: {
        localAudioAsset: true
      }
    });

    await this.prisma.playlist.update({
      where: { id: playlistId },
      data: {
        itemCount: items.length,
        cachedItemCount: items.filter((item) => item.localAudioAsset?.status === "READY").length
      }
    });
  }

  private getRelativeCacheFilePath(root: string, filePath: string) {
    if (!isPathInsideRoot(root, filePath)) {
      throw new BadRequestException("Audio cache path escapes cache root");
    }

    return relative(root, filePath);
  }

  private isPrismaUnavailable(error: unknown) {
    if (!(error instanceof Error)) {
      return false;
    }

    return (
      error.name === "PrismaClientInitializationError" ||
      error.message.includes("Environment variable not found: DATABASE_URL") ||
      error.message.includes("Can't reach database server")
    );
  }

  private getAudioContentType(filePath: string) {
    const lower = filePath.toLowerCase();

    if (lower.endsWith(".mp3")) {
      return "audio/mpeg";
    }

    if (lower.endsWith(".webm")) {
      return "audio/webm";
    }

    if (lower.endsWith(".opus")) {
      return "audio/ogg";
    }

    return "audio/mp4";
  }

  private getCoverContentType(filePath: string) {
    const lower = filePath.toLowerCase();

    if (lower.endsWith(".png")) {
      return "image/png";
    }

    return "image/jpeg";
  }
}
