import { describe, expect, it } from "vitest";

import { buildBilibiliFavoritePreviewResponse } from "./experimental-collection";

describe("buildBilibiliFavoritePreviewResponse", () => {
  it("sorts items by position and excludes excluded rows", () => {
    const response = buildBilibiliFavoritePreviewResponse({
      collection: {
        id: "collection-1",
        platformCollectionId: "123456",
        title: "我的收藏夹"
      },
      items: [
        {
          id: "item-2",
          position: 2,
          isExcluded: false,
          sourceContent: {
            platformContentId: "BV2",
            title: "Song 2",
            canonicalUrl: "https://www.bilibili.com/video/BV2",
            coverUrl: null,
            authorNameSnapshot: "UP 2",
            durationSec: 200
          }
        },
        {
          id: "item-1",
          position: 1,
          isExcluded: true,
          sourceContent: {
            platformContentId: "BV1",
            title: "Filtered",
            canonicalUrl: "https://www.bilibili.com/video/BV1",
            coverUrl: null,
            authorNameSnapshot: "UP 1",
            durationSec: 100
          }
        },
        {
          id: "item-3",
          position: 1,
          isExcluded: false,
          sourceContent: {
            platformContentId: "BV3",
            title: "Song 1",
            canonicalUrl: "https://www.bilibili.com/video/BV3",
            coverUrl: "https://cover",
            authorNameSnapshot: "UP 3",
            durationSec: 180
          }
        }
      ]
    });

    expect(response).toEqual({
      collectionId: "collection-1",
      mediaId: "123456",
      title: "我的收藏夹",
      items: [
        {
          id: "item-3",
          bvid: "BV3",
          title: "Song 1",
          url: "https://www.bilibili.com/video/BV3",
          coverUrl: "https://cover",
          ownerName: "UP 3",
          durationSeconds: 180,
          isExcluded: false
        },
        {
          id: "item-2",
          bvid: "BV2",
          title: "Song 2",
          url: "https://www.bilibili.com/video/BV2",
          coverUrl: null,
          ownerName: "UP 2",
          durationSeconds: 200,
          isExcluded: false
        }
      ]
    });
  });
});
