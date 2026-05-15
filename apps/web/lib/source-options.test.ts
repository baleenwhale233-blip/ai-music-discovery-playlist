import { describe, expect, it } from "vitest";

import { visibleSourceOptions } from "./source-options";

describe("visibleSourceOptions", () => {
  it("only exposes bilibili and youtube as link sources", () => {
    expect(visibleSourceOptions.map((source) => source.id)).toEqual(["bilibili", "youtube"]);
  });

  it("marks bilibili as available and youtube as experimental", () => {
    expect(visibleSourceOptions).toEqual([
      expect.objectContaining({
        id: "bilibili",
        label: "B站",
        status: "available"
      }),
      expect.objectContaining({
        id: "youtube",
        label: "YouTube",
        status: "experimental"
      })
    ]);
  });
});
