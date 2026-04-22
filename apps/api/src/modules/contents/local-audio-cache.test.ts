import { describe, expect, it } from "vitest";

import {
  buildYtDlpAudioArgs,
  getLocalAudioCachePaths,
  parseHttpRange,
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
      outputTemplate: "/tmp/audio-cache/BV1B7411m7LV/audio.%(ext)s"
    });

    expect(args).toEqual([
      "--no-playlist",
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
