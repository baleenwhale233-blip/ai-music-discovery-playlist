"use client";

import Link from "next/link";

import { BottomNav } from "../components/bottom-nav";
import { buildMediaUrl } from "../../lib/api";
import type { PlayMode } from "../../lib/player-state";
import { usePlayer } from "../components/player-provider";

const playModes: Array<{ mode: PlayMode; label: string }> = [
  { mode: "sequential", label: "顺序" },
  { mode: "repeat-list", label: "列表循环" },
  { mode: "repeat-one", label: "单曲循环" },
  { mode: "shuffle", label: "随机" }
];

export default function PlayerPage() {
  const player = usePlayer();
  const current = player.currentItem;

  return (
    <main className="mobile-shell player-shell with-bottom-nav">
      <header className="create-topbar">
        <Link aria-label="返回听单" className="topbar-icon" href="/playlists">‹</Link>
        <h1>播放器</h1>
        <span />
      </header>

      {current ? (
        <>
          <section className="full-player-now">
            {current.coverUrl ? <img src={buildMediaUrl(current.coverUrl) ?? ""} alt="" /> : <div className="full-player-cover" />}
            <div className="full-player-copy">
              <p className="eyebrow">{current.playlistTitle}</p>
              <h2>{current.title}</h2>
              <p>{current.artist ?? "未知作者"}</p>
            </div>
          </section>

          <section className="player-controls-panel">
            <input
              aria-label="播放进度"
              max={Math.max(player.duration, current.durationSeconds ?? 0, 1)}
              min={0}
              onChange={(event) => player.seek(Number(event.target.value))}
              type="range"
              value={player.currentTime}
            />
            <div className="time-row">
              <span>{formatTime(player.currentTime)}</span>
              <span>{formatTime(player.duration || current.durationSeconds || 0)}</span>
            </div>
            <div className="transport-row">
              <button className="secondary icon-button" onClick={player.previous} type="button">‹</button>
              <button className="primary play-button" onClick={player.togglePlay} type="button">
                {player.isPlaying ? "暂停" : "播放"}
              </button>
              <button className="secondary icon-button" onClick={player.next} type="button">›</button>
            </div>
            <div className="mode-row">
              {playModes.map((entry) => (
                <button
                  className={player.playMode === entry.mode ? "chip-button active" : "chip-button"}
                  key={entry.mode}
                  onClick={() => player.setPlayMode(entry.mode)}
                  type="button"
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </section>

          <section className="surface">
            <div className="section-title">
              <div>
                <h2>播放队列</h2>
                <p>{player.queue.length} 首已缓存音频</p>
              </div>
            </div>
            <div className="player-queue-list">
              {player.queue.map((item, index) => (
                <button
                  className={index === player.currentIndex ? "queue-row active" : "queue-row"}
                  key={item.id}
                  onClick={() => player.selectIndex(index)}
                  type="button"
                >
                  {item.coverUrl ? <img src={buildMediaUrl(item.coverUrl) ?? ""} alt="" /> : <span />}
                  <strong>{item.title}</strong>
                  <small>{item.artist ?? item.playlistTitle}</small>
                </button>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="surface">
          <h2>还没有播放队列</h2>
          <p className="lead">先在听单详情里缓存条目，再点击“播放已缓存”。</p>
          <Link className="button primary" href="/playlists">去听单</Link>
        </section>
      )}

      <BottomNav />
    </main>
  );
}

function formatTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const rest = Math.floor(safeSeconds % 60).toString().padStart(2, "0");

  return `${minutes}:${rest}`;
}
