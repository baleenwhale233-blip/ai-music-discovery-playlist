"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BilibiliParseResponse } from "@ai-music-playlist/api-contract";

import { adminEnv } from "../../../lib/env";
import { formatPlaybackTime, getProgressSeconds } from "./audio-playback";
import { getAudioPriorityUiState } from "./audio-priority";

const INPUT_KEY = "bilibili-debug:input";
const RESULT_KEY = "bilibili-debug:result";

function buildPlayableUrl(embedUrl: string, autoplay: boolean) {
  const url = new URL(embedUrl);
  url.searchParams.set("autoplay", autoplay ? "1" : "0");
  url.searchParams.set("muted", "0");
  return url.toString();
}

function parsePlayerMessage(raw: unknown) {
  if (typeof raw !== "string" || !raw.startsWith("playerOperation-")) {
    return null;
  }

  try {
    const payload = JSON.parse(raw.replace("playerOperation-", "")) as {
      type?: string;
      value?: unknown;
    };

    return payload.type ?? null;
  } catch {
    return null;
  }
}

export default function BilibiliDebugPage() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [inputUrl, setInputUrl] = useState("");
  const [result, setResult] = useState<BilibiliParseResponse | null>(null);
  const [status, setStatus] = useState("贴入一个 B 站链接开始测试。");
  const [isLoading, setIsLoading] = useState(false);
  const [isPlayerMounted, setIsPlayerMounted] = useState(false);
  const [autoplayOnMount, setAutoplayOnMount] = useState(false);
  const [playerVersion, setPlayerVersion] = useState(0);
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressBaseSeconds, setProgressBaseSeconds] = useState(0);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [playerEvents, setPlayerEvents] = useState<string[]>([]);

  useEffect(() => {
    const savedInput = window.localStorage.getItem(INPUT_KEY);
    const savedResult = window.localStorage.getItem(RESULT_KEY);

    if (savedInput) {
      setInputUrl(savedInput);
    }

    if (savedResult) {
      try {
        const parsed = JSON.parse(savedResult) as BilibiliParseResponse;
        setResult(parsed);
        setIsPlayerMounted(true);
        setAutoplayOnMount(false);
        setIsPlaying(false);
        setProgressBaseSeconds(0);
        setStartedAtMs(null);
        setIsVideoVisible(false);
        setStatus("已恢复上次解析结果，默认进入音频优先模式。");
      } catch {
        window.localStorage.removeItem(RESULT_KEY);
      }
    }
  }, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const type = parsePlayerMessage(event.data);

      if (!type) {
        return;
      }

      setPlayerEvents((current) => [type, ...current].slice(0, 8));

      if (type === "playing") {
        const startedNow = Date.now();
        setIsPlaying(true);
        setProgressBaseSeconds((current) => current);
        setStartedAtMs(startedNow);
        setNowMs(startedNow);
        setStatus("播放器已报告 playing，进度条现在跟随真实播放意图推进。");
      }

      if (type === "paused") {
        const currentProgress = getProgressSeconds({
          baseProgressSeconds: progressBaseSeconds,
          isPlaying,
          startedAtMs,
          nowMs: Date.now(),
          durationSeconds: result?.durationSeconds ?? null
        });
        setProgressBaseSeconds(currentProgress);
        setStartedAtMs(null);
        setNowMs(Date.now());
        setIsPlaying(false);
        setStatus("播放器已报告 paused。再次点击播放会尝试继续。");
      }

      if (type === "NotAutoPlay") {
        setIsPlaying(false);
        setStartedAtMs(null);
        setStatus("浏览器阻止了自动播放。请在展开的视频播放器里手动点击一次播放。");
      }

      if (type === "MutePlay") {
        setStatus("播放器进入静音自动播放。请在展开的视频播放器里取消静音。");
      }
    }

    window.addEventListener("message", handleMessage);

    return () => window.removeEventListener("message", handleMessage);
  }, [isPlaying, progressBaseSeconds, result?.durationSeconds, startedAtMs]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);

    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const iframeUrl = useMemo(() => {
    if (!result) {
      return "";
    }

    return buildPlayableUrl(result.embedUrl, autoplayOnMount);
  }, [autoplayOnMount, result]);

  const progressSeconds = getProgressSeconds({
    baseProgressSeconds: progressBaseSeconds,
    isPlaying,
    startedAtMs,
    nowMs,
    durationSeconds: result?.durationSeconds ?? null
  });

  useEffect(() => {
    if (!result?.durationSeconds) {
      return;
    }

    if (progressSeconds >= result.durationSeconds && isPlaying) {
      setProgressBaseSeconds(result.durationSeconds);
      setStartedAtMs(null);
      setIsPlaying(false);
      setAutoplayOnMount(false);
      setStatus("已到达当前估算进度末尾。若外链播放器仍在播放，可手动停止。");
    }
  }, [isPlaying, progressSeconds, result?.durationSeconds]);

  const progressPercent =
    result?.durationSeconds && result.durationSeconds > 0
      ? Math.min(100, (progressSeconds / result.durationSeconds) * 100)
      : 0;

  const coverImageUrl = result?.coverUrl
    ? `${adminEnv.apiBaseUrl}/contents/debug/cover?url=${encodeURIComponent(result.coverUrl)}`
    : null;

  const uiState = getAudioPriorityUiState({
    hasResult: Boolean(result),
    isVideoVisible,
    isPlayerMounted
  });

  async function handleParse() {
    const trimmed = inputUrl.trim();

    if (!trimmed) {
      setStatus("请先输入一个 B 站链接。");
      return;
    }

    setIsLoading(true);
    setStatus("正在解析 B 站链接...");

    try {
      const response = await fetch(`${adminEnv.apiBaseUrl}/contents/debug/parse-bilibili`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ url: trimmed })
      });

      const payload = (await response.json()) as BilibiliParseResponse | { message?: string };

      if (!response.ok) {
        throw new Error("message" in payload ? payload.message ?? "解析失败" : "解析失败");
      }

      setResult(payload as BilibiliParseResponse);
      setIsPlayerMounted(true);
      setAutoplayOnMount(false);
      setIsPlaying(false);
      setProgressBaseSeconds(0);
      setStartedAtMs(null);
      setNowMs(Date.now());
      setIsVideoVisible(false);
      setPlayerEvents([]);
      setPlayerVersion((value) => value + 1);
      window.localStorage.setItem(INPUT_KEY, trimmed);
      window.localStorage.setItem(RESULT_KEY, JSON.stringify(payload));
      setStatus("解析成功，当前默认以音频优先模式展示。封面和进度条已准备好。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "解析失败");
    } finally {
      setIsLoading(false);
    }
  }

  function handlePlay() {
    if (!result) {
      return;
    }

    const currentProgress = progressSeconds;
    setIsVideoVisible(true);
    setAutoplayOnMount(true);
    setIsPlayerMounted(true);
    setPlayerVersion((value) => value + 1);
    setProgressBaseSeconds(currentProgress);
    setStartedAtMs(null);
    setNowMs(Date.now());
    setIsPlaying(false);
    setStatus("已展开真实播放器并请求播放。如果仍未播，请在视频区域手动点击一次播放。");
  }

  function handlePause() {
    const currentProgress = progressSeconds;
    iframeRef.current?.contentWindow?.postMessage(
      `setPlayer-${JSON.stringify({ type: "play", value: false })}`,
      "*",
    );
    setAutoplayOnMount(false);
    setProgressBaseSeconds(currentProgress);
    setStartedAtMs(null);
    setNowMs(Date.now());
    setIsPlaying(false);
    setStatus("已尝试暂停。若外链播放器接受该指令，再次播放会尽量继续。");
  }

  function handleStop() {
    setIsPlayerMounted(false);
    setAutoplayOnMount(false);
    setIsPlaying(false);
    setProgressBaseSeconds(0);
    setStartedAtMs(null);
    setNowMs(Date.now());
    setPlayerVersion((value) => value + 1);
    setStatus("已停止并收起播放器，页面回到音频优先展示。");
  }

  function handleToggleVideo() {
    setIsVideoVisible((value) => !value);
  }

  function handleClear() {
    setInputUrl("");
    setResult(null);
    setIsPlayerMounted(false);
    setAutoplayOnMount(false);
    setIsPlaying(false);
    setProgressBaseSeconds(0);
    setStartedAtMs(null);
    setNowMs(Date.now());
    setIsVideoVisible(false);
    setPlayerEvents([]);
    setPlayerVersion(0);
    setStatus("已清除链接和本地缓存。");
    window.localStorage.removeItem(INPUT_KEY);
    window.localStorage.removeItem(RESULT_KEY);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "40px 24px 80px",
        display: "grid",
        gap: 24,
        background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)"
      }}
    >
      <section style={{ display: "grid", gap: 10, maxWidth: 880 }}>
        <p
          style={{
            margin: 0,
            color: "#0ea5e9",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase"
          }}
        >
          Audio-first Debug v2
        </p>
        <h1 style={{ margin: 0, fontSize: 30 }}>B 站链接解析与音频优先播放测试</h1>
        <p style={{ margin: 0, color: "#334155", lineHeight: 1.7 }}>
          这不是正式产品页面，只用于验证最小链路：贴入链接、解析 `bvid/cid`、生成外链播放器，并尽量以“听歌工具”而不是“看视频页”的方式测试。
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gap: 16,
          maxWidth: 880,
          padding: 24,
          borderRadius: 24,
          background: "rgba(255,255,255,0.92)",
          border: "1px solid rgba(148,163,184,0.18)"
        }}
      >
        <textarea
          value={inputUrl}
          onChange={(event) => setInputUrl(event.target.value)}
          placeholder="贴入一个 B 站视频链接，例如 https://www.bilibili.com/video/BV..."
          rows={4}
          style={{
            width: "100%",
            padding: 16,
            borderRadius: 16,
            border: "1px solid #cbd5e1",
            resize: "vertical",
            fontSize: 14,
            lineHeight: 1.6
          }}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <button onClick={handleParse} disabled={isLoading} style={buttonStyle("#0f172a", "#fff")}>
            {isLoading ? "解析中..." : "解析链接"}
          </button>
          <button onClick={handlePlay} disabled={!result} style={buttonStyle("#0ea5e9", "#fff")}>
            {uiState.playLabel}
          </button>
          <button onClick={handlePause} disabled={!result} style={buttonStyle("#e2e8f0", "#0f172a")}>
            {uiState.pauseLabel}
          </button>
          <button
            onClick={handleStop}
            disabled={!result || !isPlayerMounted}
            style={buttonStyle("#fff7ed", "#9a3412")}
          >
            {uiState.stopLabel}
          </button>
          <button
            onClick={handleToggleVideo}
            disabled={!result}
            style={buttonStyle("#ede9fe", "#5b21b6")}
          >
            {uiState.videoToggleLabel}
          </button>
          <button onClick={handleClear} style={buttonStyle("#fff", "#0f172a")}>
            清空链接与缓存
          </button>
        </div>

        <div
          style={{
            padding: "12px 14px",
            borderRadius: 14,
            background: "#f8fafc",
            color: "#334155",
            fontSize: 14
          }}
        >
          {status}
        </div>

        <div
          style={{
            padding: "12px 14px",
            borderRadius: 14,
            background: "#eff6ff",
            color: "#1e3a8a",
            fontSize: 14
          }}
        >
          {uiState.playerHint}
        </div>

        {playerEvents.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8
            }}
          >
            {playerEvents.map((eventName, index) => (
              <span
                key={`${eventName}-${index}`}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "#e2e8f0",
                  color: "#334155",
                  fontSize: 12,
                  fontWeight: 600
                }}
              >
                {eventName}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {result ? (
        <section
          style={{
            display: "grid",
            gap: 20,
            maxWidth: 880,
            padding: 24,
            borderRadius: 24,
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(148,163,184,0.18)"
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24 }}>
            <div
              style={{
                width: 220,
                aspectRatio: "1 / 1",
                borderRadius: 24,
                overflow: "hidden",
                background: "#dbeafe",
                boxShadow: "0 20px 50px rgba(14, 165, 233, 0.18)"
              }}
            >
              {coverImageUrl ? (
                <img
                  src={coverImageUrl}
                  alt={result.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : null}
            </div>
            <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
              <p
                style={{
                  margin: 0,
                  color: "#0ea5e9",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase"
                }}
              >
                Audio-first Debug
              </p>
              <h2 style={{ margin: 0, fontSize: 26, lineHeight: 1.35 }}>{result.title}</h2>
              <p style={{ margin: 0, color: "#475569" }}>UP 主：{result.ownerName ?? "未知"}</p>
              <p style={{ margin: 0, color: "#475569" }}>
                BVID：{result.bvid} / CID：{result.cid} / 分 P：{result.page}
              </p>
              <p style={{ margin: 0, color: "#475569" }}>
                时长：{result.durationSeconds ? `${result.durationSeconds} 秒` : "未知"}
              </p>
              <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                <div
                  style={{
                    height: 10,
                    borderRadius: 999,
                    background: "#dbeafe",
                    overflow: "hidden"
                  }}
                >
                  <div
                    style={{
                      width: `${progressPercent}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: "linear-gradient(90deg, #38bdf8 0%, #22c55e 100%)",
                      transition: "width 180ms linear"
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: "#475569",
                    fontSize: 13,
                    fontVariantNumeric: "tabular-nums"
                  }}
                >
                  <span>{formatPlaybackTime(progressSeconds)}</span>
                  <span>{formatPlaybackTime(result.durationSeconds ?? 0)}</span>
                </div>
              </div>
              <p
                style={{
                  margin: 0,
                  color: "#334155",
                  lineHeight: 1.7,
                  maxWidth: 520
                }}
              >
                当前默认隐藏视频画面，把重心放在标题、封面、进度和听感验证上。这样虽然底层仍然是视频外链播放器，但页面主观体验会更接近音乐播放测试。
              </p>
              <a href={result.normalizedUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
                打开标准化链接
              </a>
            </div>
          </div>

          {uiState.shouldRenderPlayer ? (
            isVideoVisible ? (
              <div
                style={{
                  borderRadius: 20,
                  overflow: "hidden",
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: "#000"
                }}
              >
                <iframe
                  key={`${result.bvid}-${playerVersion}`}
                  ref={iframeRef}
                  src={iframeUrl}
                  title="bilibili debug player"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                  onLoad={() => {
                    if (autoplayOnMount) {
                      window.setTimeout(() => {
                        iframeRef.current?.contentWindow?.postMessage(
                          `setPlayer-${JSON.stringify({ type: "play", value: true })}`,
                          "*",
                        );
                      }, 600);
                    }
                  }}
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    border: 0,
                    display: "block"
                  }}
                />
              </div>
            ) : (
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                  padding: 18,
                  borderRadius: 20,
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                  color: "#e2e8f0"
                }}
              >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong style={{ fontSize: 16 }}>播放器正在后台区域工作</strong>
                      <span style={{ color: "#cbd5e1", fontSize: 14 }}>
                        当前已弱化视频画面。你可以继续用上方按钮做播放、暂停和进度验证，或手动展开视频。
                      </span>
                    </div>
                    <button
                    onClick={handleToggleVideo}
                    style={buttonStyle("rgba(255,255,255,0.14)", "#fff")}
                  >
                    显示视频画面
                  </button>
                </div>
                <div
                  style={{
                    height: 12,
                    borderRadius: 999,
                    background: "rgba(148,163,184,0.2)",
                    overflow: "hidden"
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(progressPercent, isPlaying ? 12 : 6)}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: "linear-gradient(90deg, #38bdf8 0%, #22c55e 100%)",
                      transition: "width 240ms ease"
                    }}
                  />
                </div>
                <iframe
                  key={`${result.bvid}-${playerVersion}`}
                  ref={iframeRef}
                  src={iframeUrl}
                  title="bilibili debug player hidden"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                  onLoad={() => {
                    if (autoplayOnMount) {
                      window.setTimeout(() => {
                        iframeRef.current?.contentWindow?.postMessage(
                          `setPlayer-${JSON.stringify({ type: "play", value: true })}`,
                          "*",
                        );
                      }, 600);
                    }
                  }}
                  style={{
                    width: 1,
                    height: 1,
                    border: 0,
                    opacity: 0,
                    pointerEvents: "none",
                    position: "absolute"
                  }}
                />
              </div>
            )
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function buttonStyle(background: string, color: string) {
  return {
    border: "1px solid rgba(148,163,184,0.25)",
    borderRadius: 999,
    padding: "10px 16px",
    background,
    color,
    cursor: "pointer",
    fontWeight: 600
  } as const;
}
