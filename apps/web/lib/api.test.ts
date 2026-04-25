import { describe, expect, it } from "vitest";

import { buildMediaUrl } from "./api";

describe("buildMediaUrl", () => {
  it("leaves external media URLs untouched", () => {
    expect(buildMediaUrl("https://i0.hdslb.com/bfs/archive/cover.jpg")).toBe(
      "https://i0.hdslb.com/bfs/archive/cover.jpg",
    );
  });
});
