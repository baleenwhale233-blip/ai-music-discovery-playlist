import { BadRequestException, Injectable } from "@nestjs/common";
import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants, createReadStream, existsSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  bilibiliFavoritePreviewRequestSchema,
  bilibiliParseRequestSchema,
  localAudioCacheRequestSchema,
  type BilibiliFavoritePreviewRequest,
  type BilibiliFavoritePreviewResponse,
  type BilibiliParseRequest,
  type BilibiliParseResponse,
  type LocalAudioCacheRequest,
  type LocalAudioCacheResponse
} from "@ai-music-playlist/api-contract";

import { normalizeBilibiliCoverUrl } from "./bilibili-cover";
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
        outputTemplate: paths.outputTemplate
      }));
      audioFile = findCachedAudioFile(paths.itemDir);
    }

    if (!audioFile) {
      throw new BadRequestException("yt-dlp finished but no local audio file was found");
    }

    const coverFile = findCachedCoverFile(paths.itemDir);

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

    return {
      mediaId: parsed.mediaId,
      title: payloadJson.data.info?.title ?? null,
      items: (payloadJson.data.medias ?? [])
        .filter((item) => Boolean(item.bvid))
        .map((item) => ({
          bvid: item.bvid as string,
          title: item.title ?? item.bvid ?? "未命名内容",
          url: `https://www.bilibili.com/video/${item.bvid}`,
          coverUrl: normalizeBilibiliCoverUrl(item.cover),
          ownerName: item.upper?.name ?? null,
          durationSeconds: item.duration ?? null
        }))
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

  deleteCachedLocalAudio(cacheKey: string) {
    const paths = getLocalAudioCachePaths({
      cacheRoot: this.localAudioCacheRoot,
      cacheKey
    });

    if (existsSync(paths.itemDir)) {
      rmSync(paths.itemDir, { recursive: true, force: true });
    }

    return {
      cacheKey,
      deleted: true
    };
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
