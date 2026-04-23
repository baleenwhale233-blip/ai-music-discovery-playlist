import { describe, expect, it } from "vitest";

import {
  localAudioAssetStatuses,
  playbackStates,
  playlistKinds,
  sourcePlatforms,
  sourceCollectionTypes,
  conversionTaskStatuses
} from "./index";

describe("types package", () => {
  it("keeps the expected playback state contract", () => {
    expect(playbackStates).toContain("blocked_by_autoplay");
    expect(playbackStates).toHaveLength(9);
  });

  it("keeps the supported source platforms contract", () => {
    expect(sourcePlatforms).toEqual(["bilibili", "youtube", "douyin", "tiktok"]);
  });

  it("keeps playlist and source collection kinds available", () => {
    expect(playlistKinds).toEqual(["music", "learning", "mixed"]);
    expect(sourceCollectionTypes).toEqual(["favorites", "playlist", "medialist", "manual"]);
  });

  it("keeps local audio and conversion task lifecycle statuses available", () => {
    expect(localAudioAssetStatuses).toEqual(["pending", "caching", "ready", "failed", "deleted"]);
    expect(conversionTaskStatuses).toEqual([
      "created",
      "queued",
      "running",
      "succeeded",
      "failed",
      "canceled"
    ]);
  });
});
