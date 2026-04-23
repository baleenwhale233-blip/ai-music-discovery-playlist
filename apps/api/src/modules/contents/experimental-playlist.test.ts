import { describe, expect, it } from "vitest";

import { buildExperimentalPlaylistResponse } from "./experimental-playlist";

describe("buildExperimentalPlaylistResponse", () => {
  it("sorts items by position and counts cached items", () => {
    const response = buildExperimentalPlaylistResponse({
      playlist: {
        id: "playlist-1",
        name: "实验本地听单",
        kind: "MUSIC",
        sourceType: "MANUAL"
      },
      items: [
        {
          id: "item-2",
          position: 2,
          sourceContentId: "content-2",
          localAudioAssetId: null,
          titleSnapshot: "Song 2",
          coverUrlSnapshot: null,
          durationSecSnapshot: 99,
          sourceContent: { title: "Song 2", coverUrl: null, durationSec: 99 },
          localAudioAsset: null
        },
        {
          id: "item-1",
          position: 1,
          sourceContentId: "content-1",
          localAudioAssetId: "asset-1",
          titleSnapshot: null,
          coverUrlSnapshot: null,
          durationSecSnapshot: null,
          sourceContent: { title: "Song 1", coverUrl: "https://cover", durationSec: 120 },
          localAudioAsset: {
            cacheKey: "BV1",
            status: "READY"
          }
        }
      ]
    });

    expect(response.playlist.itemCount).toBe(2);
    expect(response.playlist.cachedItemCount).toBe(1);
    expect(response.items.map((item) => item.id)).toEqual(["item-1", "item-2"]);
    expect(response.items[0]).toMatchObject({
      title: "Song 1",
      audioUrl: "/api/v1/contents/experimental/local-audio/BV1/audio",
      cacheKey: "BV1",
      status: "ready"
    });
  });
});
