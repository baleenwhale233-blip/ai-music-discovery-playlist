export function getAudioPriorityUiState(input: {
  hasResult: boolean;
  isVideoVisible: boolean;
  isPlayerMounted: boolean;
}) {
  const hasResult = input.hasResult;
  const isVideoVisible = input.isVideoVisible;
  const isPlayerMounted = input.isPlayerMounted;

  return {
    playLabel: "播放",
    pauseLabel: "暂停尝试",
    stopLabel: "停止并收起播放器",
    videoToggleLabel: isVideoVisible ? "隐藏视频画面" : "显示视频画面",
    playerHint: isVideoVisible
      ? "视频画面已展开，但当前页面仍以听感验证为主。"
      : "当前是音频优先模式，视频画面默认弱化。",
    shouldRenderPlayer: hasResult && isPlayerMounted
  };
}
