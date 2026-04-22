export function getProgressSeconds(input: {
  baseProgressSeconds: number;
  isPlaying: boolean;
  startedAtMs: number | null;
  nowMs: number;
  durationSeconds: number | null;
}) {
  const duration = input.durationSeconds ?? Number.POSITIVE_INFINITY;

  if (!input.isPlaying || input.startedAtMs === null) {
    return Math.min(input.baseProgressSeconds, duration);
  }

  const elapsed = Math.max(0, (input.nowMs - input.startedAtMs) / 1000);
  return Math.min(input.baseProgressSeconds + elapsed, duration);
}

export function formatPlaybackTime(seconds: number | null) {
  const safeSeconds = Math.max(0, Math.floor(seconds ?? 0));
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (safeSeconds % 60).toString().padStart(2, "0");

  return `${minutes}:${remainder}`;
}
