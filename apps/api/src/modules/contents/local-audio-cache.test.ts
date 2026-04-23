import { describe, expect, it } from "vitest";

import {
  buildYtDlpAudioArgs,
  getLocalAudioCachePaths,
  parseHttpRange,
  resolveCookiesFromBrowserArgs,
  toSafeCacheKey
} from "./local-audio-cache";

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
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
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

  it("prefers the first available browser cookie source", () => {
    expect(
      resolveCookiesFromBrowserArgs([
        { browser: "chrome", available: false },
        { browser: "safari", available: true },
        { browser: "edge", available: true }
      ]),
    ).toEqual(["--cookies-from-browser", "safari"]);
  });

  it("parses a bounded byte range", () => {
    expect(parseHttpRange("bytes=10-19", 100)).toEqual({
      start: 10,
      end: 19,
      chunkSize: 10,
      totalSize: 100,
      contentRange: "bytes 10-19/100"
    });
  });

  it("parses an open-ended byte range", () => {
    expect(parseHttpRange("bytes=90-", 100)).toEqual({
      start: 90,
      end: 99,
      chunkSize: 10,
      totalSize: 100,
      contentRange: "bytes 90-99/100"
    });
  });

  it("returns null for unsupported ranges", () => {
    expect(parseHttpRange(undefined, 100)).toBeNull();
    expect(parseHttpRange("items=1-2", 100)).toBeNull();
    expect(parseHttpRange("bytes=200-300", 100)).toBeNull();
  });
});
