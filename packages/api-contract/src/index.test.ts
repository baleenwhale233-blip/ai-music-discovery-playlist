import { describe, expect, it } from "vitest";

import {
  authRequestCodeSchema,
  experimentalPlaylistResponseSchema,
  authVerifyCodeResponseSchema,
  bilibiliFavoritePreviewResponseSchema,
  modulePrefixes
} from "./index";

describe("api-contract package", () => {
  it("validates auth request payloads", () => {
    const parsed = authRequestCodeSchema.parse({
      phoneNumber: "13800000000",
      scenario: "login"
    });

    expect(parsed.phoneNumber).toBe("13800000000");
  });

  it("keeps the auth response contract", () => {
    const parsed = authVerifyCodeResponseSchema.parse({
      accessToken: "token",
      refreshToken: "refresh",
      expiresIn: 3600
    });

    expect(parsed.expiresIn).toBe(3600);
    expect(modulePrefixes.auth).toBe("auth");
  });

  it("keeps the experimental playlist response contract", () => {
    const parsed = experimentalPlaylistResponseSchema.parse({
      playlist: {
        id: "playlist-1",
        name: "实验本地听单",
        kind: "music",
        sourceType: "manual",
        itemCount: 2,
        cachedItemCount: 2
      },
      items: [
        {
          id: "playlist-item-1",
          sourceContentId: "content-1",
          localAudioAssetId: "asset-1",
          position: 1,
          title: "Song 1",
          coverUrl: "/api/v1/contents/experimental/local-audio/BV1/audio",
          durationSeconds: 120,
          audioUrl: "/api/v1/contents/experimental/local-audio/BV1/audio",
          cacheKey: "BV1",
          status: "ready"
        }
      ]
    });

    expect(parsed.playlist.kind).toBe("music");
    expect(parsed.items[0]?.status).toBe("ready");
  });

  it("keeps the bilibili favorite preview response contract", () => {
    const parsed = bilibiliFavoritePreviewResponseSchema.parse({
      collectionId: "collection-1",
      mediaId: "123456",
      title: "我的收藏夹",
      items: [
        {
          id: "collection-item-1",
          bvid: "BV1B7411m7LV",
          title: "Song 1",
          url: "https://www.bilibili.com/video/BV1B7411m7LV",
          coverUrl: null,
          ownerName: "UP",
          durationSeconds: 120,
          isExcluded: false
        }
      ]
    });

    expect(parsed.collectionId).toBe("collection-1");
    expect(parsed.items[0]?.isExcluded).toBe(false);
  });
});
