import { describe, expect, it } from "vitest";

import { getNextPlayerIndex, getPreviousPlayerIndex, createShuffleOrder } from "./player-state";

describe("player state helpers", () => {
  it("stops at the end in sequential mode", () => {
    expect(getNextPlayerIndex({ currentIndex: 1, itemCount: 2, playMode: "sequential" })).toBe(null);
  });

  it("wraps in repeat list mode", () => {
    expect(getNextPlayerIndex({ currentIndex: 1, itemCount: 2, playMode: "repeat-list" })).toBe(0);
    expect(getPreviousPlayerIndex({ currentIndex: 0, itemCount: 2, playMode: "repeat-list" })).toBe(1);
  });

  it("keeps the current index in repeat one mode", () => {
    expect(getNextPlayerIndex({ currentIndex: 1, itemCount: 3, playMode: "repeat-one" })).toBe(1);
  });

  it("uses a stable shuffle order without repeating the same item immediately", () => {
    const order = createShuffleOrder(["a", "b", "c"], "b");

    expect(order).toHaveLength(3);
    expect(new Set(order)).toEqual(new Set(["a", "b", "c"]));
    expect(order[0]).not.toBe("b");
  });
});
