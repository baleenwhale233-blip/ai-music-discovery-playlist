"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { buildMediaUrl } from "../../lib/api";
import {
  createShuffleOrder,
  getNextPlayerIndex,
  getNextShuffleIndex,
  getPreviousPlayerIndex,
  type PlayMode,
  type PlayerQueueItem
} from "../../lib/player-state";

interface PlayerContextValue {
  queue: PlayerQueueItem[];
  currentItem: PlayerQueueItem | null;
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playMode: PlayMode;
  playQueue: (items: PlayerQueueItem[], startIndex?: number) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setPlayMode: (mode: PlayMode) => void;
  selectIndex: (index: number) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);
const STORAGE_KEY = "video_audio_player_state";

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<PlayerQueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playMode, setPlayModeState] = useState<PlayMode>("sequential");
  const [shuffleOrder, setShuffleOrder] = useState<string[]>([]);
  const currentItem = queue[currentIndex] ?? null;

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved) as {
        queue?: PlayerQueueItem[];
        currentIndex?: number;
        playMode?: PlayMode;
        shuffleOrder?: string[];
      };
      setQueue(parsed.queue ?? []);
      setCurrentIndex(parsed.currentIndex ?? 0);
      setPlayModeState(parsed.playMode ?? "sequential");
      setShuffleOrder(parsed.shuffleOrder ?? []);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        queue,
        currentIndex,
        playMode,
        shuffleOrder
      }),
    );
  }, [currentIndex, playMode, queue, shuffleOrder]);

  useEffect(() => {
    const audio = audioRef.current;
    const playableUrl = buildMediaUrl(currentItem?.audioUrl ?? null);

    if (!audio || !playableUrl) {
      return;
    }

    if (audio.src !== playableUrl) {
      audio.src = playableUrl;
      audio.load();
    }

    if (isPlaying) {
      void audio.play().catch(() => setIsPlaying(false));
    }
  }, [currentItem, isPlaying]);

  const goToIndex = useCallback((index: number, shouldPlay = isPlaying) => {
    setCurrentIndex(Math.max(0, Math.min(index, queue.length - 1)));
    setCurrentTime(0);
    setIsPlaying(shouldPlay);
  }, [isPlaying, queue.length]);

  const next = useCallback(() => {
    if (queue.length === 0) {
      return;
    }

    const nextIndex = playMode === "shuffle"
      ? getNextShuffleIndex({ queue, currentIndex, shuffleOrder })
      : getNextPlayerIndex({ currentIndex, itemCount: queue.length, playMode });

    if (nextIndex === null) {
      setIsPlaying(false);
      return;
    }

    goToIndex(nextIndex, true);
  }, [currentIndex, goToIndex, playMode, queue, shuffleOrder]);

  const previous = useCallback(() => {
    const previousIndex = getPreviousPlayerIndex({ currentIndex, itemCount: queue.length, playMode });

    if (previousIndex !== null) {
      goToIndex(previousIndex, true);
    }
  }, [currentIndex, goToIndex, playMode, queue.length]);

  const value = useMemo<PlayerContextValue>(() => ({
    queue,
    currentItem,
    currentIndex,
    isPlaying,
    currentTime,
    duration,
    playMode,
    playQueue(items, startIndex = 0) {
      setQueue(items);
      setCurrentIndex(startIndex);
      setCurrentTime(0);
      setDuration(0);
      setShuffleOrder(createShuffleOrder(items.map((item) => item.id), items[startIndex]?.id));
      setIsPlaying(items.length > 0);
    },
    togglePlay() {
      setIsPlaying((current) => !current);
    },
    next,
    previous,
    seek(time) {
      const audio = audioRef.current;

      if (audio) {
        audio.currentTime = time;
      }

      setCurrentTime(time);
    },
    setPlayMode(mode) {
      setPlayModeState(mode);
      if (mode === "shuffle") {
        setShuffleOrder(createShuffleOrder(queue.map((item) => item.id), currentItem?.id));
      }
    },
    selectIndex(index) {
      goToIndex(index, true);
    }
  }), [currentIndex, currentItem, currentTime, duration, goToIndex, isPlaying, next, playMode, previous, queue]);

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onEnded={next}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        preload="metadata"
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const value = useContext(PlayerContext);

  if (!value) {
    throw new Error("usePlayer must be used inside PlayerProvider");
  }

  return value;
}
