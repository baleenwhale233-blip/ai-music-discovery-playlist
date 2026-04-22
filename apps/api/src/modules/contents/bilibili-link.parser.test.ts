import { describe, expect, it } from "vitest";

import { parseBilibiliFavoriteLink, parseBilibiliLink } from "./bilibili-link.parser";

describe("parseBilibiliLink", () => {
  it("extracts bvid and page from a standard bilibili video url", () => {
    const parsed = parseBilibiliLink(
      "https://www.bilibili.com/video/BV1B7411m7LV?p=2&spm_id_from=333.1007.tianma.1-1-1.click",
    );

    expect(parsed).toEqual({
      bvid: "BV1B7411m7LV",
      page: 2,
      normalizedUrl: "https://www.bilibili.com/video/BV1B7411m7LV?p=2",
    });
  });

  it("extracts bvid from a mobile share url", () => {
    const parsed = parseBilibiliLink("https://m.bilibili.com/video/BV1B7411m7LV");

    expect(parsed).toEqual({
      bvid: "BV1B7411m7LV",
      page: 1,
      normalizedUrl: "https://www.bilibili.com/video/BV1B7411m7LV?p=1",
    });
  });

  it("throws on unsupported links", () => {
    expect(() => parseBilibiliLink("https://example.com/video/foo")).toThrow(
      "Unsupported bilibili link",
    );
  });
});

describe("parseBilibiliFavoriteLink", () => {
  it("extracts media_id from a bilibili favorite url", () => {
    expect(
      parseBilibiliFavoriteLink("https://space.bilibili.com/123/favlist?fid=987654&ftype=create"),
    ).toEqual({
      mediaId: "987654"
    });
  });

  it("extracts media_id from a text snippet", () => {
    expect(parseBilibiliFavoriteLink("我的收藏夹 media_id=112233")).toEqual({
      mediaId: "112233"
    });
  });

  it("extracts media_id from modern bilibili lists urls", () => {
    expect(parseBilibiliFavoriteLink("https://space.bilibili.com/123/lists/445566?type=season")).toEqual({
      mediaId: "445566"
    });
  });

  it("extracts media_id from medialist detail urls", () => {
    expect(parseBilibiliFavoriteLink("https://www.bilibili.com/medialist/detail/ml778899")).toEqual({
      mediaId: "778899"
    });
  });

  it("extracts media_id from bilibili list urls", () => {
    expect(
      parseBilibiliFavoriteLink("https://www.bilibili.com/list/ml3960775205?oid=115755324543781"),
    ).toEqual({
      mediaId: "3960775205"
    });
  });

  it("throws on unsupported favorite urls", () => {
    expect(() => parseBilibiliFavoriteLink("https://example.com/foo")).toThrow(
      "Unsupported bilibili favorite link",
    );
  });
});
