import { describe, expect, it } from "vitest";

import { visibleSourceOptions } from "./source-options";

describe("visibleSourceOptions", () => {
  it("only exposes bilibili in the public alpha add flow", () => {
    expect(visibleSourceOptions.map((source) => source.id)).toEqual(["bilibili"]);
  });

  it("marks bilibili as available", () => {
    expect(visibleSourceOptions).toEqual([
      expect.objectContaining({
        id: "bilibili",
        label: "B站",
        status: "available"
      })
    ]);
  });
});
