import Link from "next/link";
import type { PublishedPlaylistSummary } from "../../lib/playlist-domain";
import { buildMediaUrl } from "../../lib/api";

export function PlaylistCard({ playlist, featured = false }: { playlist: PublishedPlaylistSummary; featured?: boolean }) {
  const coverUrl = buildMediaUrl(playlist.coverUrl);

  return (
    <Link className={featured ? "playlist-card featured" : "playlist-card"} href={`/playlists/${encodeURIComponent(playlist.id)}`}>
      <div className="cover-stack">
        {coverUrl ? <img src={coverUrl} alt="" /> : <div className="cover-fallback">{playlist.title.slice(0, 1)}</div>}
      </div>
      <div className="playlist-card-body">
        <p className="eyebrow">{playlist.kind === "learning" ? "Learning" : "AI Music"}</p>
        <h2>{playlist.title}</h2>
        <p>{playlist.description || "发布的是目录元信息，缓存和播放仍由你主动完成。"}</p>
      </div>
      <div className="playlist-card-meta">
        <span>{playlist.itemCount} 条</span>
        <span>{playlist.cachedItemCount > 0 ? `已缓存 ${playlist.cachedItemCount}` : "未缓存"}</span>
        <span>{playlist.creatorName}</span>
      </div>
    </Link>
  );
}
