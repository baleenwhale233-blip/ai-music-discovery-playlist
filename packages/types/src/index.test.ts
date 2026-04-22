import { describe, expect, it } from "vitest";

import { playbackStates } from "./index";

describe("types package", () => {
  it("keeps the expected playback state contract", () => {
    expect(playbackStates).toContain("blocked_by_autoplay");
    expect(playbackStates).toHaveLength(9);
  });
});
