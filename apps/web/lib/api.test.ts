import { describe, expect, it } from "vitest";

import { buildMediaUrl } from "./api";

describe("buildMediaUrl", () => {
  it("routes bilibili image hosts through the formal cover proxy", () => {
    expect(buildMediaUrl("https://i0.hdslb.com/bfs/archive/cover.jpg")).toBe(
      "http://127.0.0.1:4000/api/v1/contents/cover?url=https%3A%2F%2Fi0.hdslb.com%2Fbfs%2Farchive%2Fcover.jpg",
    );
  });

  it("leaves non-bilibili external media URLs untouched", () => {
    expect(buildMediaUrl("https://example.com/media.mp3")).toBe("https://example.com/media.mp3");
  });
});
