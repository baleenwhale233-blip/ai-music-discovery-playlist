import { describe, expect, it } from "vitest";

import { formatPlaybackTime, getProgressSeconds } from "./audio-playback";

describe("audio-playback helpers", () => {
  it("advances progress while playing and clamps at duration", () => {
    expect(
      getProgressSeconds({
        baseProgressSeconds: 12,
        isPlaying: true,
        startedAtMs: 1_000,
        nowMs: 6_000,
        durationSeconds: 15
      }),
    ).toBe(15);
  });

  it("returns the base progress when paused", () => {
    expect(
      getProgressSeconds({
        baseProgressSeconds: 42,
        isPlaying: false,
        startedAtMs: null,
        nowMs: 100_000,
        durationSeconds: 300
      }),
    ).toBe(42);
  });

  it("formats playback time as mm:ss", () => {
    expect(formatPlaybackTime(0)).toBe("00:00");
    expect(formatPlaybackTime(65)).toBe("01:05");
    expect(formatPlaybackTime(615)).toBe("10:15");
  });
});
