"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LocalAudioPlaylistItem, LocalAudioPlaylistResponse } from "@ai-music-playlist/api-contract";

import {
  buildMediaUrl,
  clearLocalAudioPlaylist,
  deletePlaylistItem,
  getLocalAudioPlaylist,
  getStoredToken
} from "../../lib/api";

export default function PlaylistPage() {
  const [playlist, setPlaylist] = useState<LocalAudioPlaylistResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState("正在读取你的本地听单。");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!getStoredToken()) {
      setStatus("需要先登录。");
      return;
    }

    const result = await getLocalAudioPlaylist();
    setPlaylist(result);
    setCurrentIndex((index) => Math.min(index, Math.max(result.items.length - 1, 0)));
    setStatus(result.items.length ? "听单已就绪。" : "听单为空，先去导入页缓存几首。");
  }

  useEffect(() => {
    void refresh().catch((error) => setStatus(error instanceof Error ? error.message : "读取失败"));
  }, []);

  async function removeItem(item: LocalAudioPlaylistItem) {
    setBusy(true);

    try {
      await deletePlaylistItem(item.id);
      await refresh();
      setStatus(`已移除：${item.title}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "移除失败");
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    setBusy(true);

    try {
      await clearLocalAudioPlaylist();
      await refresh();
      setStatus("已清空本地听单和缓存。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "清空失败");
    } finally {
      setBusy(false);
    }
  }

  const items = playlist?.items ?? [];
  const current = items[currentIndex] ?? null;

  return (
    <main className="app-shell">
      <nav className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">AI Music</span>
          <strong>本地听单</strong>
        </Link>
        <div className="nav">
          <Link className="secondary" href="/">导入</Link>
          <Link href="/playlist">听单</Link>
        </div>
      </nav>

      <section className="hero">
        <p className="eyebrow">Real Audio Player</p>
        <h1>这里不再假装 iframe 是播放器。</h1>
        <p className="lead">只有缓存完成的本地音频才会出现在播放器里。播放、暂停、拖动进度和连播都交给真实 media element。</p>
      </section>

      <div className="grid">
        <section className="panel player-card">
          <h2>{playlist?.playlist.name ?? "我的本地听单"}</h2>
          {current ? (
            <div className="now-playing">
              {current.coverUrl ? <img className="thumb" src={buildMediaUrl(current.coverUrl) ?? ""} alt="" /> : <div className="thumb" />}
              <div>
                <p className="eyebrow">Now Playing</p>
                <h2>{current.title}</h2>
                <p className="muted">{currentIndex + 1} / {items.length}</p>
              </div>
              <audio
                controls
                onEnded={() => {
                  if (currentIndex < items.length - 1) {
                    setCurrentIndex(currentIndex + 1);
                  }
                }}
                preload="metadata"
                src={buildMediaUrl(current.audioUrl) ?? undefined}
              />
            </div>
          ) : (
            <p className="lead">听单还是空的。先从导入页缓存一两首，别一上来就把几百首合集全塞进锅里。</p>
          )}
          <div className="actions">
            <button className="secondary" disabled={busy} onClick={() => void refresh()}>刷新</button>
            <button className="danger" disabled={busy || items.length === 0} onClick={clearAll}>清空听单</button>
          </div>
          <div className="status">{status}</div>
        </section>

        <section className="panel subtle">
          <h2>队列</h2>
          <p className="muted">已缓存 {playlist?.playlist.cachedItemCount ?? 0} / {playlist?.playlist.itemCount ?? 0} 条。</p>
          <div className="list">
            {items.map((item, index) => (
              <article className="row playlist-row" key={item.id}>
                {item.coverUrl ? <img className="thumb" src={buildMediaUrl(item.coverUrl) ?? ""} alt="" /> : <div className="thumb" />}
                <button className="secondary title" onClick={() => setCurrentIndex(index)}>{item.title}</button>
                <button className="danger" disabled={busy} onClick={() => void removeItem(item)}>移除</button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
