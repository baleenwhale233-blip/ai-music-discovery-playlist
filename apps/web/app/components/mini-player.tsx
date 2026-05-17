"use client";

import Link from "next/link";

import { buildMediaUrl } from "../../lib/api";
import { usePlayer } from "./player-provider";

export function MiniPlayer() {
  const player = usePlayer();
  const item = player.currentItem;

  if (!item) {
    return null;
  }

  return (
    <div className="mini-player" role="region" aria-label="迷你播放器">
      <Link className="mini-player-main" href="/player">
        {item.coverUrl ? <img src={buildMediaUrl(item.coverUrl) ?? ""} alt="" /> : <span className="mini-player-cover" />}
        <span>
          <strong>{item.title}</strong>
          <small>{item.artist ?? item.playlistTitle}</small>
        </span>
      </Link>
      <button aria-label={player.isPlaying ? "暂停" : "播放"} className="mini-player-button" onClick={player.togglePlay} type="button">
        {player.isPlaying ? "Ⅱ" : "▶"}
      </button>
    </div>
  );
}
