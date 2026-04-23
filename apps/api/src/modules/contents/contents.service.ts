import { BadRequestException, Injectable } from "@nestjs/common";
import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants, createReadStream, existsSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  bilibiliFavoritePreviewRequestSchema,
  bilibiliParseRequestSchema,
  type ExperimentalPlaylistResponse,
  localAudioCacheRequestSchema,
  type BilibiliFavoritePreviewRequest,
  type BilibiliFavoritePreviewResponse,
  type BilibiliParseRequest,
  type BilibiliParseResponse,
  type LocalAudioCacheRequest,
  type LocalAudioCacheResponse
} from "@ai-music-playlist/api-contract";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { buildExperimentalPlaylistResponse } from "./experimental-playlist";

import { normalizeBilibiliCoverUrl } from "./bilibili-cover";
import { buildBilibiliFavoritePreviewResponse } from "./experimental-collection";
import {
  isResolvableBilibiliShortLink,
  parseBilibiliFavoriteLink,
  parseBilibiliLink
} from "./bilibili-link.parser";
import {
  buildYtDlpAudioArgs,
  ensureAudioCacheDir,
  findCachedAudioFile,
  findCachedCoverFile,
  getLocalAudioCachePaths,
  resolveCookiesFromBrowserArgs,
  toSafeCacheKey
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
  private readonly localAudioCacheRoot = join(process.cwd(), ".local-audio-cache");
  private readonly experimentalUserEmail = "local-audio-experiment@system.local";
  private readonly experimentalPlaylistName = "实验本地听单";

  constructor(private readonly prisma: PrismaService) {}

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
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
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
    this.assertExecutableAvailable("yt-dlp");
    this.assertExecutableAvailable("ffmpeg");

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
      await this.runYtDlp(buildYtDlpAudioArgs({
        sourceUrl: parsed.normalizedUrl,
        outputTemplate: paths.outputTemplate,
        cookieArgs: this.getCookiesFromBrowserArgs()
      }));
      audioFile = findCachedAudioFile(paths.itemDir);
    }

    if (!audioFile) {
      throw new BadRequestException("yt-dlp finished but no local audio file was found");
    }

    const coverFile = findCachedCoverFile(paths.itemDir);

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
          coverFile && coverFile.startsWith(paths.root)
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
          coverFile && coverFile.startsWith(paths.root)
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
        platform_platformCollectionId: {
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

    await this.prisma.localAudioAsset.updateMany({
      where: {
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

  async getExperimentalPlaylist(): Promise<ExperimentalPlaylistResponse> {
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
  }

  async removeExperimentalPlaylistItem(playlistItemId: string) {
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
  }

  async clearExperimentalPlaylist() {
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
    return filePath.replace(`${root}/`, "");
  }

  private assertExecutableAvailable(command: string) {
    for (const candidate of [`/opt/homebrew/bin/${command}`, `/usr/local/bin/${command}`]) {
      try {
        accessSync(candidate, constants.X_OK);
        return;
      } catch {
        // Keep checking common locations and PATH.
      }
    }

    const check = spawnSync(command, ["--version"], {
      stdio: "ignore"
    });

    if (check.status !== 0) {
      throw new BadRequestException(
        `${command} is required for this local audio experiment. Install it with: brew install yt-dlp ffmpeg`,
      );
    }
  }

  private runYtDlp(args: string[]) {
    return new Promise<void>((resolve, reject) => {
      const child = spawn("yt-dlp", args, {
        stdio: ["ignore", "pipe", "pipe"]
      });
      const stderr: string[] = [];

      child.stderr.on("data", (chunk: Buffer) => {
        stderr.push(chunk.toString("utf8"));
      });
      child.on("error", (error) => reject(error));
      child.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new BadRequestException(stderr.join("").trim() || `yt-dlp exited with ${code}`));
      });
    });
  }

  private getCookiesFromBrowserArgs() {
    return resolveCookiesFromBrowserArgs([
      {
        browser: "chrome",
        available: existsSync("/Applications/Google Chrome.app")
      },
      {
        browser: "safari",
        available: existsSync("/Applications/Safari.app")
      },
      {
        browser: "edge",
        available: existsSync("/Applications/Microsoft Edge.app")
      },
      {
        browser: "firefox",
        available: existsSync("/Applications/Firefox.app")
      }
    ]);
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
