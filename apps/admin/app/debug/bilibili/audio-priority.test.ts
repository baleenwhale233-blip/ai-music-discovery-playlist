import { describe, expect, it } from "vitest";

import { getAudioPriorityUiState } from "./audio-priority";

describe("getAudioPriorityUiState", () => {
  it("defaults to audio-first copy before any result is parsed", () => {
    expect(
      getAudioPriorityUiState({
        hasResult: false,
        isVideoVisible: false,
        isPlayerMounted: false
      }),
    ).toEqual({
      playLabel: "播放",
      pauseLabel: "暂停尝试",
      stopLabel: "停止并收起播放器",
      videoToggleLabel: "显示视频画面",
      playerHint: "当前是音频优先模式，视频画面默认弱化。",
      shouldRenderPlayer: false
    });
  });

  it("shows the right labels when video is expanded and player is mounted", () => {
    expect(
      getAudioPriorityUiState({
        hasResult: true,
        isVideoVisible: true,
        isPlayerMounted: true
      }),
    ).toEqual({
      playLabel: "播放",
      pauseLabel: "暂停尝试",
      stopLabel: "停止并收起播放器",
      videoToggleLabel: "隐藏视频画面",
      playerHint: "视频画面已展开，但当前页面仍以听感验证为主。",
      shouldRenderPlayer: true
    });
  });
});
