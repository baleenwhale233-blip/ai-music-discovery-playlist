import { describe, expect, it } from "vitest";

import { normalizeBilibiliCoverUrl } from "./bilibili-cover";

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
});
