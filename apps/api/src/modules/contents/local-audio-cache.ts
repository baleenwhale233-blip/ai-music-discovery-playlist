import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const AUDIO_EXTENSIONS = new Set([".m4a", ".mp3", ".aac", ".opus", ".webm"]);

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
    outputTemplate: join(itemDir, "audio.%(ext)s")
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
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
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
