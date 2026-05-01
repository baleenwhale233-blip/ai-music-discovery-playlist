import { describe, expect, it } from "vitest";

import { buildBilibiliCoverProxyPath, normalizeBilibiliCoverUrl } from "./bilibili-cover";

describe("normalizeBilibiliCoverUrl", () => {
  it("upgrades http bilibili covers to https", () => {
    expect(
      normalizeBilibiliCoverUrl(
        "http://i2.hdslb.com/bfs/archive/0b83569178ab10ccfdbebd7a7a5f1545c4d76bef.jpg",
      ),
    ).toBe("https://i2.hdslb.com/bfs/archive/0b83569178ab10ccfdbebd7a7a5f1545c4d76bef.jpg");
  });

  it("keeps https bilibili covers unchanged", () => {
    expect(
      normalizeBilibiliCoverUrl(
        "https://i0.hdslb.com/bfs/archive/abc.jpg",
      ),
    ).toBe("https://i0.hdslb.com/bfs/archive/abc.jpg");
  });

  it("upgrades protocol-relative bilibili covers to https", () => {
    expect(normalizeBilibiliCoverUrl("//i0.hdslb.com/bfs/archive/abc.jpg")).toBe(
      "https://i0.hdslb.com/bfs/archive/abc.jpg",
    );
  });

  it("returns null when there is no source cover", () => {
    expect(normalizeBilibiliCoverUrl(undefined)).toBeNull();
  });

  it("returns null for unsupported cover hosts", () => {
    expect(normalizeBilibiliCoverUrl("https://example.com/cover.jpg")).toBeNull();
  });
});

describe("buildBilibiliCoverProxyPath", () => {
  it("builds a formal API proxy path for bilibili covers", () => {
    expect(buildBilibiliCoverProxyPath("//i0.hdslb.com/bfs/archive/abc.jpg")).toBe(
      "/api/v1/contents/cover?url=https%3A%2F%2Fi0.hdslb.com%2Fbfs%2Farchive%2Fabc.jpg",
    );
  });

  it("returns null for unsupported cover hosts", () => {
    expect(buildBilibiliCoverProxyPath("https://example.com/cover.jpg")).toBeNull();
  });
});
