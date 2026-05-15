"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BottomNav } from "../../components/bottom-nav";
import { LoginPrompt } from "../../components/login-prompt";
import { PageHeader } from "../../components/page-header";
import { PlaylistItemRow } from "../../components/playlist-item-row";
import { buildMediaUrl, getStoredToken } from "../../../lib/api";
import type { PublishedPlaylistDetail } from "../../../lib/playlist-domain";
import { createPlaylistRepository } from "../../../lib/playlist-repository-factory";

export default function PlaylistDetailPage() {
  const params = useParams<{ playlistId: string }>();
  const repository = useMemo(() => createPlaylistRepository(), []);
  const [tokenReady, setTokenReady] = useState(false);
  const [playlist, setPlaylist] = useState<PublishedPlaylistDetail | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("发布的是目录元信息，缓存后才会进入你的本地播放器。");
  const [busy, setBusy] = useState(false);
  const playlistId = decodeURIComponent(params.playlistId);

  useEffect(() => {
    const hasToken = Boolean(getStoredToken());
    setTokenReady(hasToken);

    if (!hasToken) {
      return;
    }

    void repository.getPublishedPlaylist(playlistId).then((result) => {
      setPlaylist(result);
      if (!result) {
        setStatus("没有找到这张听单。");
      }
    });
  }, [playlistId, repository]);

  async function cacheSelectedItems() {
    if (!playlist || selectedIds.size === 0) {
      return;
    }

    setBusy(true);
    setStatus("正在缓存选中条目。缓存文件只属于当前登录用户。");

    try {
      const result = await repository.cachePublishedPlaylistItems(playlist.id, Array.from(selectedIds));
      setPlaylist(result.playlist);
      setSelectedIds(new Set());
      const cachedCount = result.results.reduce((sum, item) => sum + item.cachedCount, 0);
      const failedCount = result.results.reduce((sum, item) => sum + item.failedCount, 0);
      setStatus(`缓存完成：成功 ${cachedCount} 条，失败 ${failedCount} 条。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "缓存失败");
    } finally {
      setBusy(false);
    }
  }

  if (!tokenReady) {
    return <LoginPrompt />;
  }

  if (!playlist) {
    return (
      <main className="mobile-shell with-bottom-nav">
        <PageHeader actionHref="/playlists" actionLabel="回广场" eyebrow="Playlist" title="听单详情" />
        <section className="surface">
          <p className="lead">{status}</p>
        </section>
        <BottomNav />
      </main>
    );
  }

  const cacheableIds = playlist.items
    .filter((item) => item.collectionId && item.importItemId && item.cacheStatus !== "cached")
    .map((item) => item.id);
  const coverUrl = buildMediaUrl(playlist.coverUrl);
  const playerHref = `/player/${encodeURIComponent(playlist.id)}`;

  return (
    <main className="mobile-shell with-bottom-nav">
      <PageHeader
        actionHref={playerHref}
        actionLabel="打开播放器"
        description={playlist.description || "这是一张目录听单。缓存后才会进入你的真实播放器。"}
        eyebrow={playlist.isSample ? "Sample Directory" : "Published Directory"}
        title={playlist.title}
      />

      <section className="surface playlist-detail-hero">
        <div className="cover-stack large">
          {coverUrl ? <img src={coverUrl} alt="" /> : <div className="cover-fallback">{playlist.title.slice(0, 1)}</div>}
        </div>
        <div>
          <p className="eyebrow">Bilibili</p>
          <h2>{playlist.creatorName}</h2>
          <p className="lead">{playlist.itemCount} 条目录项 / 已缓存 {playlist.cachedItemCount} 条</p>
        </div>
      </section>

      <section className="surface">
        <div className="section-title">
          <div>
            <h2>目录条目</h2>
            <p>选中真实解析条目后，可以保存到你的本地缓存。</p>
          </div>
          <button disabled={busy || selectedIds.size === 0} onClick={() => void cacheSelectedItems()}>
            缓存已选
          </button>
        </div>
        <div className="toolbar">
          <button className="secondary" disabled={cacheableIds.length === 0 || busy} onClick={() => setSelectedIds(new Set(cacheableIds))}>
            选择可缓存
          </button>
          <button className="secondary" disabled={selectedIds.size === 0 || busy} onClick={() => setSelectedIds(new Set())}>
            取消
          </button>
          <Link className="button secondary" href={playerHref}>查看本地播放器</Link>
        </div>
        <div className="status">{status}</div>
        <div className="item-list">
          {playlist.items.map((item) => {
            const canSelect = Boolean(item.collectionId && item.importItemId && item.cacheStatus !== "cached");

            return (
              <PlaylistItemRow
                checked={selectedIds.has(item.id)}
                disabled={!canSelect || busy}
                item={item}
                key={item.id}
                onToggle={(id, checked) => {
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    if (checked) {
                      next.add(id);
                    } else {
                      next.delete(id);
                    }
                    return next;
                  });
                }}
                selectable
              />
            );
          })}
        </div>
      </section>

      <BottomNav />
    </main>
  );
}
