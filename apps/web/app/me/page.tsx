"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { BottomNav } from "../components/bottom-nav";
import { LoginPrompt } from "../components/login-prompt";
import { PageHeader } from "../components/page-header";
import { PlaylistCard } from "../components/playlist-card";
import { buildMediaUrl, clearToken, getMeLibrary, getStoredToken } from "../../lib/api";
import type { LocalAudioPlaylistResponse } from "@ai-music-playlist/api-contract";
import type { PlaylistDraft, PublishedPlaylistSummary } from "../../lib/playlist-domain";
import { createPlaylistRepository } from "../../lib/playlist-repository-factory";
import type { PlaylistSummary } from "@ai-music-playlist/api-contract";

export default function MePage() {
  const repository = useMemo(() => createPlaylistRepository(), []);
  const [tokenReady, setTokenReady] = useState(false);
  const [draft, setDraft] = useState<PlaylistDraft | null>(null);
  const [created, setCreated] = useState<PublishedPlaylistSummary[]>([]);
  const [favorites, setFavorites] = useState<PublishedPlaylistSummary[]>([]);
  const [localPlaylist, setLocalPlaylist] = useState<LocalAudioPlaylistResponse | null>(null);
  const [nickname, setNickname] = useState("Alpha 用户");

  useEffect(() => {
    const hasToken = Boolean(getStoredToken());
    setTokenReady(hasToken);

    if (!hasToken) {
      return;
    }

    void repository.getActiveDraft().then(setDraft);
    void getMeLibrary()
      .then((library) => {
        setNickname(library.user.nickname);
        setCreated(library.createdPlaylists.map(toSummary));
        setFavorites(library.favoritePlaylists.map(toSummary));
        setLocalPlaylist({
          playlist: {
            id: "recent-local-audio",
            name: "最近本地缓存",
            kind: "music",
            sourceType: "manual",
            itemCount: library.recentLocalAudioItems.length,
            cachedItemCount: library.recentLocalAudioItems.filter((item) => item.status === "ready").length
          },
          items: library.recentLocalAudioItems
        });
      })
      .catch(() => setLocalPlaylist(null));
  }, [repository]);

  if (!tokenReady) {
    return <LoginPrompt />;
  }

  return (
    <main className="mobile-shell with-bottom-nav">
      <PageHeader
        actionHref="/playlists/new"
        actionLabel="添加听单"
        description="管理草稿、已发布目录和你的本地缓存。"
        eyebrow={nickname}
        title="我的"
      />

      <section className="surface stats-grid">
        <div>
          <strong>{draft?.items.length ?? 0}</strong>
          <span>草稿条目</span>
        </div>
        <div>
          <strong>{created.length}</strong>
          <span>我创建的</span>
        </div>
        <div>
          <strong>{localPlaylist?.playlist.cachedItemCount ?? 0}</strong>
          <span>已缓存</span>
        </div>
      </section>

      <section className="surface">
        <div className="section-title">
          <div>
            <h2>草稿箱</h2>
            <p>{draft?.items.length ? `${draft.items.length} 条等待发布` : "暂无草稿条目"}</p>
          </div>
          <Link className="button secondary" href="/playlists/new">打开草稿</Link>
        </div>
      </section>

      <section className="surface">
        <div className="section-title">
          <div>
            <h2>收藏的听单</h2>
            <p>{favorites.length ? `${favorites.length} 张已收藏` : "还没有收藏的听单"}</p>
          </div>
        </div>
      </section>

      <section className="module-grid">
        {favorites.map((playlist) => (
          <PlaylistCard key={playlist.id} playlist={playlist} />
        ))}
      </section>

      <section className="surface">
        <div className="section-title">
          <div>
            <h2>我创建的听单</h2>
            <p>{created.length ? `${created.length} 张听单` : "还没有发布过听单"}</p>
          </div>
        </div>
      </section>

      <section className="module-grid">
        {created.map((playlist) => (
          <PlaylistCard key={playlist.id} playlist={playlist} />
        ))}
      </section>

      <section className="surface">
        <div className="section-title">
          <div>
            <h2>最近本地缓存</h2>
            <p>缓存文件只属于当前账号和当前后端环境。</p>
          </div>
          <Link className="button secondary" href="/player">播放器</Link>
        </div>
        <div className="mini-cache-list">
          {(localPlaylist?.items ?? []).slice(0, 4).map((item) => (
            <div className="mini-cache-item" key={item.id}>
              {item.coverUrl ? <img src={buildMediaUrl(item.coverUrl) ?? ""} alt="" /> : <div />}
              <span>{item.title}</span>
            </div>
          ))}
          {!localPlaylist?.items.length ? <p className="lead">还没有本地缓存，先从听单详情里保存几首。</p> : null}
        </div>
      </section>

      <section className="surface">
        <button
          className="secondary"
          onClick={() => {
            clearToken();
            window.location.href = "/login";
          }}
        >
          退出登录
        </button>
      </section>

      <BottomNav />
    </main>
  );
}

function toSummary(playlist: PlaylistSummary): PublishedPlaylistSummary {
  return {
    id: playlist.id,
    title: playlist.title,
    description: playlist.description ?? "",
    coverUrl: playlist.coverUrl ?? playlist.coverItems[0] ?? null,
    visibility: playlist.visibility,
    kind: "music",
    creatorName: playlist.ownerDisplayName,
    ownerUserId: playlist.ownerUserId,
    sourcePlatforms: ["bilibili"],
    itemCount: playlist.itemCount,
    cachedItemCount: playlist.cachedCountForCurrentUser,
    isOwner: playlist.isOwner,
    favoritedByCurrentUser: playlist.favoritedByCurrentUser,
    isSample: playlist.isEditorial,
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt
  };
}
