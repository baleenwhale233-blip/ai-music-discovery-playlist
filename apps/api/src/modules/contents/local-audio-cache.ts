import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const AUDIO_EXTENSIONS = new Set([".m4a", ".mp3", ".aac", ".opus", ".webm"]);
const METADATA_FILE_NAME = "metadata.json";
export const BILIBILI_DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
export const BILIBILI_MOBILE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

export function toSafeCacheKey(input: string) {
  const safe = input.replace(/[^0-9A-Za-z_-]/g, "");

  if (!safe) {
    throw new Error("Invalid cache key");
  }

  return safe;
}

export function getLocalAudioCachePaths(input: { cacheRoot: string; cacheKey: string }) {
  const safeKey = toSafeCacheKey(input.cacheKey);
  const root = resolve(input.cacheRoot);
  const itemDir = resolve(root, safeKey);

  if (!itemDir.startsWith(root)) {
    throw new Error("Audio cache path escapes cache root");
  }

  return {
    root,
    itemDir,
    outputTemplate: join(itemDir, "audio.%(ext)s"),
    outputAudioPath: join(itemDir, "audio.m4a"),
    metadataPath: join(itemDir, METADATA_FILE_NAME)
  };
}

export function ensureAudioCacheDir(path: string) {
  mkdirSync(path, { recursive: true });
}

export function buildYtDlpAudioArgs(input: {
  sourceUrl: string;
  outputTemplate: string;
  cookieArgs?: string[];
}) {
  return buildYtDlpAudioArgsWithOptions({
    sourceUrl: input.sourceUrl,
    outputTemplate: input.outputTemplate,
    cookieArgs: input.cookieArgs ?? []
  });
}

export function buildYtDlpAudioArgsWithOptions(input: {
  sourceUrl: string;
  outputTemplate: string;
  cookieArgs: string[];
}) {
  return [
    "--no-playlist",
    "--referer",
    "https://www.bilibili.com/",
    "--user-agent",
    BILIBILI_DESKTOP_USER_AGENT,
    ...input.cookieArgs,
    "--extract-audio",
    "--audio-format",
    "m4a",
    "--audio-quality",
    "0",
    "--write-thumbnail",
    "--convert-thumbnails",
    "jpg",
    "--output",
    input.outputTemplate,
    input.sourceUrl
  ];
}

export function buildFfmpegAudioExtractArgs(input: { sourceUrl: string; outputAudioPath: string }) {
  return [
    "-y",
    "-headers",
    `Referer: https://m.bilibili.com/\r\nUser-Agent: ${BILIBILI_MOBILE_USER_AGENT}\r\n`,
    "-i",
    input.sourceUrl,
    "-vn",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    input.outputAudioPath
  ];
}

export function extractAssignedJsonObject(input: { html: string; marker: string }) {
  const start = input.html.indexOf(input.marker);

  if (start < 0) {
    throw new Error(`Missing marker: ${input.marker}`);
  }

  const jsonStart = start + input.marker.length;
  let depth = 0;
  let end = -1;
  let inString = false;
  let escaped = false;

  for (let index = jsonStart; index < input.html.length; index += 1) {
    const char = input.html[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }

  if (end < 0) {
    throw new Error(`Unable to parse JSON for marker: ${input.marker}`);
  }

  return input.html.slice(jsonStart, end);
}

type BilibiliMobileInitialState = {
  video?: {
    playUrlInfo?: Array<{
      url?: string;
      length?: number;
      size?: number;
    }>;
    viewInfo?: {
      cid?: number;
      title?: string;
      pic?: string;
    };
  };
};

export function parseBilibiliMobileHtml5Playback(input: { html: string }) {
  const json = extractAssignedJsonObject({
    html: input.html,
    marker: "window.__INITIAL_STATE__="
  });
  const state = JSON.parse(json) as BilibiliMobileInitialState;
  const firstPlayable = state.video?.playUrlInfo?.find((item) => item.url);

  if (!firstPlayable?.url) {
    throw new Error("Unable to resolve bilibili mobile play url");
  }

  return {
    playUrl: firstPlayable.url,
    cid: state.video?.viewInfo?.cid ?? null,
    title: state.video?.viewInfo?.title ?? null,
    coverUrl: state.video?.viewInfo?.pic ?? null
  };
}

export type LocalAudioCacheMetadata = {
  cacheKey: string;
  sourceUrl: string;
  normalizedUrl: string;
  title: string;
  bvid: string;
  coverUrl: string | null;
  durationSeconds: number | null;
  createdAt: string;
};

export function writeLocalAudioCacheMetadata(input: {
  metadataPath: string;
  metadata: LocalAudioCacheMetadata;
}) {
  writeFileSync(input.metadataPath, JSON.stringify(input.metadata, null, 2), "utf8");
}

export function readLocalAudioCacheMetadata(metadataPath: string) {
  if (!existsSync(metadataPath)) {
    return null;
  }

  return JSON.parse(readFileSync(metadataPath, "utf8")) as LocalAudioCacheMetadata;
}

export function listLocalAudioCacheKeys(cacheRoot: string) {
  const root = resolve(cacheRoot);

  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root)
    .map((entry) => join(root, entry))
    .filter((entryPath) => statSync(entryPath).isDirectory())
    .map((entryPath) => basename(entryPath))
    .sort();
}

export function resolveCookiesFromBrowserArgs(
  candidates: Array<{ browser: string; available: boolean }>,
) {
  const match = candidates.find((candidate) => candidate.available);

  if (!match) {
    return [];
  }

  return ["--cookies-from-browser", match.browser];
}

export function findCachedAudioFile(itemDir: string) {
  if (!existsSync(itemDir)) {
    return null;
  }

  const files = readdirSync(itemDir)
    .map((fileName) => join(itemDir, fileName))
    .filter((filePath) => {
      const stats = statSync(filePath);
      const lowerName = basename(filePath).toLowerCase();

      return stats.isFile() && [...AUDIO_EXTENSIONS].some((extension) => lowerName.endsWith(extension));
    })
    .sort();

  return files[0] ?? null;
}

export function findCachedCoverFile(itemDir: string) {
  if (!existsSync(itemDir)) {
    return null;
  }

  const files = readdirSync(itemDir)
    .map((fileName) => join(itemDir, fileName))
    .filter((filePath) => {
      const stats = statSync(filePath);
      const lowerName = basename(filePath).toLowerCase();

      return (
        stats.isFile() &&
        (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg") || lowerName.endsWith(".png"))
      );
    })
    .sort();

  return files[0] ?? null;
}

export function parseHttpRange(rangeHeader: string | undefined, totalSize: number) {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=") || totalSize <= 0) {
    return null;
  }

  const [startRaw, endRaw] = rangeHeader.replace("bytes=", "").split("-");
  const start = Number(startRaw);

  if (!Number.isFinite(start) || start < 0 || start >= totalSize) {
    return null;
  }

  const requestedEnd = endRaw ? Number(endRaw) : totalSize - 1;
  const end = Math.min(Number.isFinite(requestedEnd) ? requestedEnd : totalSize - 1, totalSize - 1);

  if (end < start) {
    return null;
  }

  const chunkSize = end - start + 1;

  return {
    start,
    end,
    chunkSize,
    totalSize,
    contentRange: `bytes ${start}-${end}/${totalSize}`
  };
}
