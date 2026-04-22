import { create } from "zustand";

import type { PlaybackMode, PlaybackState } from "@ai-music-playlist/types";

interface PlayerState {
  playbackState: PlaybackState;
  mode: PlaybackMode;
  currentContentId?: string;
  setPlaybackState: (playbackState: PlaybackState) => void;
  setMode: (mode: PlaybackMode) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  playbackState: "idle",
  mode: "sequential",
  currentContentId: undefined,
  setPlaybackState: (playbackState) => set({ playbackState }),
  setMode: (mode) => set({ mode })
}));
