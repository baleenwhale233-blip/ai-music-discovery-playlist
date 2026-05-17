export type PlayMode = "sequential" | "repeat-list" | "repeat-one" | "shuffle";

export interface PlayerQueueItem {
  id: string;
  playlistId: string;
  playlistTitle: string;
  title: string;
  artist: string | null;
  coverUrl: string | null;
  audioUrl: string;
  durationSeconds: number | null;
}

export interface PlayerStateSnapshot {
  queue: PlayerQueueItem[];
  currentIndex: number;
  playMode: PlayMode;
  shuffleOrder: string[];
}

export function getNextPlayerIndex(input: {
  currentIndex: number;
  itemCount: number;
  playMode: PlayMode;
}): number | null {
  if (input.itemCount === 0) {
    return null;
  }

  if (input.playMode === "repeat-one") {
    return input.currentIndex;
  }

  if (input.currentIndex < input.itemCount - 1) {
    return input.currentIndex + 1;
  }

  return input.playMode === "repeat-list" ? 0 : null;
}

export function getPreviousPlayerIndex(input: {
  currentIndex: number;
  itemCount: number;
  playMode: PlayMode;
}): number | null {
  if (input.itemCount === 0) {
    return null;
  }

  if (input.playMode === "repeat-one") {
    return input.currentIndex;
  }

  if (input.currentIndex > 0) {
    return input.currentIndex - 1;
  }

  return input.playMode === "repeat-list" ? input.itemCount - 1 : 0;
}

export function createShuffleOrder(itemIds: string[], currentItemId?: string | null) {
  const remaining = itemIds.filter((id) => id !== currentItemId);

  for (let index = remaining.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    const current = remaining[index];
    const swap = remaining[target];

    if (current && swap) {
      remaining[index] = swap;
      remaining[target] = current;
    }
  }

  return currentItemId && itemIds.includes(currentItemId)
    ? [...remaining, currentItemId]
    : remaining;
}

export function getNextShuffleIndex(input: {
  queue: PlayerQueueItem[];
  currentIndex: number;
  shuffleOrder: string[];
}) {
  const current = input.queue[input.currentIndex];

  if (!current) {
    return null;
  }

  const currentShuffleIndex = input.shuffleOrder.indexOf(current.id);
  const nextId = input.shuffleOrder[currentShuffleIndex + 1] ?? input.shuffleOrder[0] ?? null;

  if (!nextId || nextId === current.id) {
    return null;
  }

  const nextIndex = input.queue.findIndex((item) => item.id === nextId);

  return nextIndex === -1 ? null : nextIndex;
}
