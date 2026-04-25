import { describe, expect, it } from "vitest";

import {
  buildFfmpegAudioExtractArgs,
  buildYtDlpAudioArgs,
  BILIBILI_DESKTOP_USER_AGENT,
  BILIBILI_MOBILE_USER_AGENT,
  getLocalAudioCachePaths,
  isPathInsideRoot,
  listLocalAudioCacheKeys,
  parseBilibiliMobileHtml5Playback,
  parseHttpRange,
  readLocalAudioCacheMetadata,
  resolveCookiesFromBrowserArgs,
  toSafeCacheKey,
  writeLocalAudioCacheMetadata
} from "./local-audio-cache";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("local audio cache helpers", () => {
  it("creates stable safe cache keys from bvid", () => {
    expect(toSafeCacheKey("BV1B7411m7LV")).toBe("BV1B7411m7LV");
    expect(toSafeCacheKey("../BV1B7411m7LV")).toBe("BV1B7411m7LV");
  });

  it("keeps generated paths inside the configured cache root", () => {
    const paths = getLocalAudioCachePaths({
      cacheRoot: "/tmp/audio-cache",
      cacheKey: "BV1B7411m7LV"
    });

    expect(paths.itemDir).toBe("/tmp/audio-cache/BV1B7411m7LV");
    expect(paths.outputTemplate).toBe("/tmp/audio-cache/BV1B7411m7LV/audio.%(ext)s");
    expect(paths.outputAudioPath).toBe("/tmp/audio-cache/BV1B7411m7LV/audio.m4a");
  });

  it("rejects path traversal input when building cache paths", () => {
    expect(() =>
      getLocalAudioCachePaths({
        cacheRoot: "/tmp/audio-cache",
        cacheKey: "../../etc/passwd"
      }),
    ).toThrow("Invalid cache key");
  });

  it("detects whether a resolved path is inside the cache root", () => {
    expect(isPathInsideRoot("/tmp/audio-cache", "/tmp/audio-cache/BV1/audio.m4a")).toBe(true);
    expect(isPathInsideRoot("/tmp/audio-cache", "/tmp/audio-cache-evil/BV1/audio.m4a")).toBe(false);
  });

  it("builds yt-dlp args for audio extraction without playlists", () => {
    const args = buildYtDlpAudioArgs({
      sourceUrl: "https://www.bilibili.com/video/BV1B7411m7LV",
      outputTemplate: "/tmp/audio-cache/BV1B7411m7LV/audio.%(ext)s",
      cookieArgs: ["--cookies-from-browser", "safari"]
    });

    expect(args).toEqual([
      "--no-playlist",
      "--referer",
      "https://www.bilibili.com/",
      "--user-agent",
      BILIBILI_DESKTOP_USER_AGENT,
      "--cookies-from-browser",
      "safari",
      "--extract-audio",
      "--audio-format",
      "m4a",
      "--audio-quality",
      "0",
      "--write-thumbnail",
      "--convert-thumbnails",
      "jpg",
      "--output",
      "/tmp/audio-cache/BV1B7411m7LV/audio.%(ext)s",
      "https://www.bilibili.com/video/BV1B7411m7LV"
    ]);
  });

  it("builds ffmpeg args for direct mobile page extraction", () => {
    const args = buildFfmpegAudioExtractArgs({
      sourceUrl: "https://example.com/audio-video.mp4",
      outputAudioPath: "/tmp/audio-cache/BV1B7411m7LV/audio.m4a"
    });

    expect(args).toEqual([
      "-y",
      "-headers",
      `Referer: https://m.bilibili.com/\r\nUser-Agent: ${BILIBILI_MOBILE_USER_AGENT}\r\n`,
      "-i",
      "https://example.com/audio-video.mp4",
      "-vn",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "/tmp/audio-cache/BV1B7411m7LV/audio.m4a"
    ]);
  });

  it("extracts a direct playback url from bilibili mobile html", () => {
    const html = `
      <script>
        window.__INITIAL_STATE__={"video":{"viewInfo":{"cid":168325345,"title":"demo title","pic":"https://example.com/cover.jpg"},"playUrlInfo":[{"url":"https://example.com/media.mp4","length":1234,"size":5678}]}}
      </script>
    `;

    expect(parseBilibiliMobileHtml5Playback({ html })).toEqual({
      playUrl: "https://example.com/media.mp4",
      cid: 168325345,
      title: "demo title",
      coverUrl: "https://example.com/cover.jpg"
    });
  });

  it("writes and reads local audio cache metadata", () => {
    const root = mkdtempSync(join(tmpdir(), "local-audio-cache-"));
    const paths = getLocalAudioCachePaths({
      cacheRoot: root,
      cacheKey: "BV1B7411m7LV"
    });
    mkdirSync(paths.itemDir, { recursive: true });

    writeLocalAudioCacheMetadata({
      metadataPath: paths.metadataPath,
      metadata: {
        cacheKey: "BV1B7411m7LV",
        sourceUrl: "https://www.bilibili.com/video/BV1B7411m7LV?p=1",
        normalizedUrl: "https://www.bilibili.com/video/BV1B7411m7LV?p=1",
        title: "demo title",
        bvid: "BV1B7411m7LV",
        coverUrl: "https://example.com/cover.jpg",
        durationSeconds: 321,
        createdAt: "2026-04-23T12:00:00.000Z"
      }
    });

    expect(readLocalAudioCacheMetadata(paths.metadataPath)).toEqual({
      cacheKey: "BV1B7411m7LV",
      sourceUrl: "https://www.bilibili.com/video/BV1B7411m7LV?p=1",
      normalizedUrl: "https://www.bilibili.com/video/BV1B7411m7LV?p=1",
      title: "demo title",
      bvid: "BV1B7411m7LV",
      coverUrl: "https://example.com/cover.jpg",
      durationSeconds: 321,
      createdAt: "2026-04-23T12:00:00.000Z"
    });
  });

  it("lists local audio cache keys from cache directories", () => {
    const root = mkdtempSync(join(tmpdir(), "local-audio-cache-"));
    mkdirSync(join(root, "BV1B7411m7LV"));
    mkdirSync(join(root, "BV2demo"));

    expect(listLocalAudioCacheKeys(root)).toEqual(["BV1B7411m7LV", "BV2demo"]);
  });

  it("prefers the first available browser cookie source", () => {
    expect(
      resolveCookiesFromBrowserArgs([
        { browser: "chrome", available: false },
        { browser: "safari", available: true },
        { browser: "edge", available: true }
      ]),
    ).toEqual(["--cookies-from-browser", "safari"]);
  });

  it("parses bytes=0-99", () => {
    expect(parseHttpRange("bytes=0-99", 1000)).toEqual({
      kind: "range",
      start: 0,
      end: 99,
      chunkSize: 100,
      totalSize: 1000,
      contentRange: "bytes 0-99/1000"
    });
  });

  it("parses bytes=100-", () => {
    expect(parseHttpRange("bytes=100-", 1000)).toEqual({
      kind: "range",
      start: 100,
      end: 999,
      chunkSize: 900,
      totalSize: 1000,
      contentRange: "bytes 100-999/1000"
    });
  });

  it("parses bytes=-500", () => {
    expect(parseHttpRange("bytes=-500", 1000)).toEqual({
      kind: "range",
      start: 500,
      end: 999,
      chunkSize: 500,
      totalSize: 1000,
      contentRange: "bytes 500-999/1000"
    });
  });

  it("clamps bytes=0-999999 when the file is smaller", () => {
    expect(parseHttpRange("bytes=0-999999", 1000)).toEqual({
      kind: "range",
      start: 0,
      end: 999,
      chunkSize: 1000,
      totalSize: 1000,
      contentRange: "bytes 0-999/1000"
    });
  });

  it("separates missing range from invalid range", () => {
    expect(parseHttpRange(undefined, 100)).toBeNull();
    expect(parseHttpRange("items=1-2", 100)).toEqual({
      kind: "invalid",
      totalSize: 100,
      contentRange: "bytes */100"
    });
    expect(parseHttpRange("bytes=200-300", 100)).toEqual({
      kind: "invalid",
      totalSize: 100,
      contentRange: "bytes */100"
    });
  });
});
