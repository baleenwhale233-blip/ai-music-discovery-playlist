import { describe, expect, it } from "vitest";

import { buildLocalAudioPlaylistResponse } from "./local-audio-playlist";

describe("buildLocalAudioPlaylistResponse", () => {
  it("maps ready local assets to stable formal audio and cover urls", () => {
    const response = buildLocalAudioPlaylistResponse({
      playlist: {
        id: "playlist-1",
        name: "我的本地听单",
        kind: "MUSIC",
        sourceType: "MANUAL"
      },
      items: [
        {
          id: "item-1",
          sourceContentId: "content-1",
          localAudioAssetId: "asset-1",
          position: 1,
          titleSnapshot: "Song 1",
          coverUrlSnapshot: "https://i0.hdslb.com/cover.jpg",
          durationSecSnapshot: 120,
          sourceContent: {
            title: "Fallback title",
            coverUrl: null,
            durationSec: null
          },
          localAudioAsset: {
            id: "asset-1",
            cacheKey: "user-1_BV1B7411m7LV",
            status: "READY"
          }
        }
      ]
    });

    expect(response.playlist.itemCount).toBe(1);
    expect(response.playlist.cachedItemCount).toBe(1);
    expect(response.items[0]).toMatchObject({
      audioUrl: "/api/v1/local-audio/user-1_BV1B7411m7LV/audio",
      coverUrl: "/api/v1/local-audio/user-1_BV1B7411m7LV/cover",
      status: "ready"
    });
  });
});
