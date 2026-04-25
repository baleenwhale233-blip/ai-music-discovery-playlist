import { describe, expect, it } from "vitest";

import { fetchBilibiliImportPreview } from "./bilibili-import-preview";

describe("fetchBilibiliImportPreview", () => {
  it("returns a single candidate for normal bilibili video links", async () => {
    const fetchImpl = async (url: string) => {
      expect(url).toContain("x/web-interface/view?bvid=BV1B7411m7LV");

      return new Response(
        JSON.stringify({
          code: 0,
          message: "0",
          data: {
            title: "Single Song",
            pic: "//i0.hdslb.com/bfs/archive/single.jpg",
            duration: 180,
            owner: {
              name: "UP"
            }
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        },
      );
    };

    const preview = await fetchBilibiliImportPreview({
      url: "https://www.bilibili.com/video/BV1B7411m7LV",
      fetchImpl
    });

    expect(preview.sourceType).toBe("single");
    expect(preview.items).toHaveLength(1);
    expect(preview.items[0]).toMatchObject({
      bvid: "BV1B7411m7LV",
      title: "Single Song",
      ownerName: "UP"
    });
  });

  it("uses conservative ps=20 pagination for bilibili list/ml links", async () => {
    const requestedUrls: string[] = [];
    const fetchImpl = async (url: string) => {
      requestedUrls.push(url);

      return new Response(
        JSON.stringify({
          code: 0,
          message: "0",
          data: {
            info: {
              title: "歌单？",
              media_count: 21
            },
            has_more: requestedUrls.length === 1,
            medias: [
              {
                bvid: `BV1B7411m7L${requestedUrls.length}`,
                title: `Song ${requestedUrls.length}`,
                cover: "//i0.hdslb.com/bfs/archive/cover.jpg",
                duration: 120,
                upper: {
                  name: "UP"
                }
              }
            ]
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        },
      );
    };

    const preview = await fetchBilibiliImportPreview({
      url: "https://www.bilibili.com/list/ml3960775205?oid=115755324543781",
      limit: 21,
      fetchImpl
    });

    expect(preview.title).toBe("歌单？");
    expect(preview.totalCount).toBe(21);
    expect(preview.items).toHaveLength(2);
    expect(requestedUrls).toHaveLength(2);
    expect(requestedUrls.every((url) => url.includes("ps=20"))).toBe(true);
    expect(preview.items[0]?.coverUrl).toBe("https://i0.hdslb.com/bfs/archive/cover.jpg");
  });
});
