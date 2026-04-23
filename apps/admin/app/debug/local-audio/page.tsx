"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BilibiliFavoritePreviewItem,
  BilibiliFavoritePreviewResponse,
  ExperimentalPlaylistResponse,
  LocalAudioCacheResponse
} from "@ai-music-playlist/api-contract";

import { adminEnv } from "../../../lib/env";

function resolveApiAssetUrl(path: string) {
  return `${adminEnv.apiBaseUrl.replace(/\/api\/v1$/, "")}${path}`;
}

function getCoverUrl(
  item:
    | LocalAudioCacheResponse
    | BilibiliFavoritePreviewItem
    | ExperimentalPlaylistResponse["items"][number]
    | null,
) {
  if (!item?.coverUrl) {
    return null;
  }

  return item.coverUrl.startsWith("/api/") ? resolveApiAssetUrl(item.coverUrl) : item.coverUrl;
}

export default function LocalAudioExperimentPage() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [inputUrl, setInputUrl] = useState("");
  const [favoriteUrl, setFavoriteUrl] = useState("");
  const [playlistData, setPlaylistData] = useState<ExperimentalPlaylistResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [favoritePreview, setFavoritePreview] = useState<BilibiliFavoritePreviewResponse | null>(null);
  const [status, setStatus] = useState("贴入一个 B 站链接，生成本地音频缓存后加入实验播放单。");
  const [isLoading, setIsLoading] = useState(false);
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);

  const playlist = playlistData?.items ?? [];
  const currentItem = playlist[currentIndex] ?? null;
  const coverUrl = getCoverUrl(currentItem);

  const selectedCandidates = useMemo(() => favoritePreview?.items ?? [], [favoritePreview]);

  useEffect(() => {
    void refreshPlaylist().catch(() => undefined);
  }, []);

  async function refreshPlaylist() {
    const response = await fetch(`${adminEnv.apiBaseUrl}/contents/experimental/local-audio/playlist`);
    const payload = (await response.json()) as ExperimentalPlaylistResponse | { message?: string };

    if (!response.ok) {
      throw new Error("message" in payload ? payload.message ?? "读取实验播放单失败" : "读取实验播放单失败");
    }

    setPlaylistData(payload as ExperimentalPlaylistResponse);
  }

  async function cacheLink(url: string) {
    const response = await fetch(`${adminEnv.apiBaseUrl}/contents/experimental/local-audio`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ url })
    });
    const payload = (await response.json()) as LocalAudioCacheResponse | { message?: string };

    if (!response.ok) {
      throw new Error("message" in payload ? payload.message ?? "生成失败" : "生成失败");
    }

    return payload as LocalAudioCacheResponse;
  }

  async function handleAddSingleLink() {
    const trimmed = inputUrl.trim();

    if (!trimmed) {
      setStatus("请先输入一个 B 站链接。");
      return;
    }

    setIsLoading(true);
    setStatus("正在生成本地音频缓存。首次转换可能需要几十秒...");

    try {
      const item = await cacheLink(trimmed);
      await refreshPlaylist();
      setCurrentIndex((index) => (playlist.length === 0 ? 0 : index));
      setInputUrl("");
      setStatus(`${item.title} 已加入实验播放单。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "生成失败");
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePreviewFavorite() {
    const trimmed = favoriteUrl.trim();

    if (!trimmed) {
      setStatus("请先输入一个 B 站收藏夹链接。");
      return;
    }

    setIsFavoriteLoading(true);
    setStatus("正在解析收藏夹，稍后可以删除非歌曲条目。");

    try {
      const response = await fetch(`${adminEnv.apiBaseUrl}/contents/experimental/bilibili-favorite-preview`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ url: trimmed, limit: 30 })
      });
      const payload = (await response.json()) as BilibiliFavoritePreviewResponse | { message?: string };

      if (!response.ok) {
        throw new Error("message" in payload ? payload.message ?? "解析收藏夹失败" : "解析收藏夹失败");
      }

      setFavoritePreview(payload as BilibiliFavoritePreviewResponse);
      setStatus(`已解析收藏夹：${(payload as BilibiliFavoritePreviewResponse).title ?? "未命名收藏夹"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "解析收藏夹失败");
    } finally {
      setIsFavoriteLoading(false);
    }
  }

  async function handleRemoveCandidate(collectionItemId: string) {
    await fetch(`${adminEnv.apiBaseUrl}/contents/experimental/source-collections/items/${collectionItemId}`, {
      method: "DELETE"
    }).catch(() => undefined);

    setFavoritePreview((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        items: current.items.filter((item) => item.id !== collectionItemId)
      };
    });
  }

  async function handleCacheCandidates() {
    if (selectedCandidates.length === 0) {
      setStatus("候选列表为空。");
      return;
    }

    setIsFavoriteLoading(true);
    setStatus("正在逐首生成本地音频缓存，请保持页面打开。");

    try {
      const cachedItems: LocalAudioCacheResponse[] = [];

      for (const candidate of selectedCandidates) {
        setStatus(`正在缓存：${candidate.title}`);
        cachedItems.push(await cacheLink(candidate.url));
      }

      await refreshPlaylist();
      setFavoritePreview(null);
      setStatus(`已加入 ${cachedItems.length} 首到实验播放单。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "批量缓存失败");
    } finally {
      setIsFavoriteLoading(false);
    }
  }

  async function handleClearPlaylist() {
    await fetch(`${adminEnv.apiBaseUrl}/contents/experimental/local-audio/playlist`, {
      method: "DELETE"
    }).catch(() => undefined);

    setPlaylistData((current) =>
      current
        ? {
            ...current,
            items: [],
            playlist: {
              ...current.playlist,
              itemCount: 0,
              cachedItemCount: 0
            }
          }
        : null,
    );
    setCurrentIndex(0);
    setStatus("已清空实验播放单，并请求删除本地音频缓存。");
  }

  async function handleRemovePlaylistItem(playlistItemId: string) {
    await fetch(`${adminEnv.apiBaseUrl}/contents/experimental/local-audio/playlist/items/${playlistItemId}`, {
      method: "DELETE"
    }).catch(() => undefined);

    await refreshPlaylist();
    setCurrentIndex(0);
  }

  function handleEnded() {
    if (currentIndex < playlist.length - 1) {
      setCurrentIndex((index) => index + 1);
      window.setTimeout(() => {
        void audioRef.current?.play();
      }, 250);
      return;
    }

    setStatus("实验播放单已播放完毕。");
  }

  return (
    <main style={pageStyle}>
      <section style={{ display: "grid", gap: 10, maxWidth: 960 }}>
        <p style={eyebrowStyle}>Experimental Local Playlist v1</p>
        <h1 style={{ margin: 0, fontSize: 30 }}>本地音频实验播放单</h1>
        <p style={{ margin: 0, color: "#334155", lineHeight: 1.7 }}>
          这里验证“目录链接 → 用户主动本地缓存 → 原生 audio 连续播放”的体验。可以单条添加，也可以先解析 B
          站收藏夹成候选播放单，再删除非歌曲/非学习内容。
        </p>
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>单条添加</h2>
        <textarea
          value={inputUrl}
          onChange={(event) => setInputUrl(event.target.value)}
          placeholder="贴入一个 B 站视频链接，例如 https://www.bilibili.com/video/BV..."
          rows={3}
          style={textAreaStyle}
        />
        <button onClick={handleAddSingleLink} disabled={isLoading} style={buttonStyle("#0f172a", "#fff")}>
          {isLoading ? "生成中..." : "保存为本地音频并加入播放单"}
        </button>
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>B 站收藏夹候选播放单</h2>
        <textarea
          value={favoriteUrl}
          onChange={(event) => setFavoriteUrl(event.target.value)}
          placeholder="贴入 B 站收藏夹链接，例如 https://space.bilibili.com/.../favlist?fid=..."
          rows={3}
          style={textAreaStyle}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <button onClick={handlePreviewFavorite} disabled={isFavoriteLoading} style={buttonStyle("#0891b2", "#fff")}>
            {isFavoriteLoading ? "处理中..." : "解析收藏夹"}
          </button>
          <button
            onClick={handleCacheCandidates}
            disabled={!favoritePreview || selectedCandidates.length === 0 || isFavoriteLoading}
            style={buttonStyle("#0f172a", "#fff")}
          >
            缓存候选为本地播放单
          </button>
        </div>

        {favoritePreview ? (
          <div style={{ display: "grid", gap: 12 }}>
            <p style={{ margin: 0, color: "#475569" }}>
              候选：{favoritePreview.title ?? favoritePreview.mediaId} / {favoritePreview.items.length} 条
            </p>
            {favoritePreview.items.map((item) => (
              <div key={item.bvid} style={rowStyle}>
                {getCoverUrl(item) ? (
                  <img src={getCoverUrl(item) ?? ""} alt={item.title} style={thumbStyle} />
                ) : (
                  <div style={thumbStyle} />
                )}
                <div style={{ display: "grid", gap: 4 }}>
                  <strong>{item.title}</strong>
                  <span style={{ color: "#64748b", fontSize: 13 }}>
                    {item.ownerName ?? "未知 UP"} / {item.durationSeconds ? `${item.durationSeconds} 秒` : "未知时长"}
                  </span>
                </div>
                <button onClick={() => handleRemoveCandidate(item.id)} style={buttonStyle("#fff", "#991b1b")}>
                  删除
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
          <h2 style={sectionTitleStyle}>实验播放单</h2>
          <button onClick={handleClearPlaylist} disabled={playlist.length === 0} style={buttonStyle("#fff", "#0f172a")}>
            清空播放单和本地缓存
          </button>
        </div>

        <div style={{ padding: "12px 14px", borderRadius: 14, background: "#f8fafc", color: "#334155" }}>
          {status}
        </div>

        {currentItem ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 20 }}>
              {coverUrl ? (
                <img src={coverUrl} alt={currentItem.title} style={{ ...thumbStyle, width: 180, height: 180 }} />
              ) : (
                <div style={{ ...thumbStyle, width: 180, height: 180 }} />
              )}
              <div style={{ display: "grid", gap: 8, alignContent: "center" }}>
                <p style={eyebrowStyle}>Now Playing</p>
                <h2 style={{ margin: 0 }}>{currentItem.title}</h2>
                <p style={{ margin: 0, color: "#475569" }}>缓存键：{currentItem.cacheKey ?? "未生成"}</p>
                <p style={{ margin: 0, color: "#475569" }}>
                  {currentIndex + 1} / {playlist.length}
                </p>
                <p style={{ margin: 0, color: "#475569" }}>
                  已缓存：{playlistData?.playlist.cachedItemCount ?? 0} / {playlistData?.playlist.itemCount ?? 0}
                </p>
              </div>
            </div>

            <audio
              key={currentItem.cacheKey}
              ref={audioRef}
              src={currentItem.audioUrl ? resolveApiAssetUrl(currentItem.audioUrl) : ""}
              controls
              preload="metadata"
              onEnded={handleEnded}
              style={{ width: "100%" }}
            />
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 10 }}>
          {playlist.map((item, index) => (
            <div
              key={item.cacheKey}
              style={{
                ...rowStyle,
                borderColor: index === currentIndex ? "#0891b2" : "rgba(148,163,184,0.2)"
              }}
            >
              {getCoverUrl(item) ? (
                <img src={getCoverUrl(item) ?? ""} alt={item.title} style={thumbStyle} />
              ) : (
                <div style={thumbStyle} />
              )}
              <button onClick={() => setCurrentIndex(index)} style={linkButtonStyle}>
                {item.title}
              </button>
              <button onClick={() => handleRemovePlaylistItem(item.id)} style={buttonStyle("#fff", "#991b1b")}>
                移除
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  padding: "40px 24px 80px",
  display: "grid",
  gap: 24,
  background: "linear-gradient(180deg, #f8fafc 0%, #ecfeff 100%)"
} as const;

const cardStyle = {
  display: "grid",
  gap: 16,
  maxWidth: 960,
  padding: 24,
  borderRadius: 24,
  background: "rgba(255,255,255,0.92)",
  border: "1px solid rgba(148,163,184,0.18)"
} as const;

const rowStyle = {
  display: "grid",
  gridTemplateColumns: "64px minmax(0, 1fr) auto",
  gap: 12,
  alignItems: "center",
  padding: 12,
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,0.2)",
  background: "#fff"
} as const;

const thumbStyle = {
  width: 64,
  height: 64,
  borderRadius: 14,
  objectFit: "cover",
  background: "#cffafe"
} as const;

const eyebrowStyle = {
  margin: 0,
  color: "#0891b2",
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
} as const;

const sectionTitleStyle = {
  margin: 0,
  fontSize: 20
} as const;

const textAreaStyle = {
  width: "100%",
  padding: 16,
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  resize: "vertical",
  fontSize: 14,
  lineHeight: 1.6
} as const;

const linkButtonStyle = {
  border: 0,
  padding: 0,
  background: "transparent",
  color: "#0f172a",
  fontWeight: 700,
  textAlign: "left",
  cursor: "pointer",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
} as const;

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
