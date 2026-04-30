"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { BottomNav } from "../components/bottom-nav";
import { LoginPrompt } from "../components/login-prompt";
import { PageHeader } from "../components/page-header";
import { PlaylistCard } from "../components/playlist-card";
import { buildMediaUrl, clearToken, getLocalAudioPlaylist, getStoredToken } from "../../lib/api";
import type { LocalAudioPlaylistResponse } from "@ai-music-playlist/api-contract";
import type { PlaylistDraft, PublishedPlaylistSummary } from "../../lib/playlist-domain";
import { createPlaylistRepository } from "../../lib/playlist-repository-factory";

export default function MePage() {
  const repository = useMemo(() => createPlaylistRepository(), []);
  const [tokenReady, setTokenReady] = useState(false);
  const [draft, setDraft] = useState<PlaylistDraft | null>(null);
  const [published, setPublished] = useState<PublishedPlaylistSummary[]>([]);
  const [localPlaylist, setLocalPlaylist] = useState<LocalAudioPlaylistResponse | null>(null);

  useEffect(() => {
    const hasToken = Boolean(getStoredToken());
    setTokenReady(hasToken);

    if (!hasToken) {
      return;
    }

    void repository.getActiveDraft().then(setDraft);
    void repository.listPublishedPlaylists().then((items) => setPublished(items.filter((item) => !item.isSample)));
    void getLocalAudioPlaylist().then(setLocalPlaylist).catch(() => setLocalPlaylist(null));
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
        eyebrow="My Library"
        title="我的"
      />

      <section className="surface stats-grid">
        <div>
          <strong>{draft?.items.length ?? 0}</strong>
          <span>草稿条目</span>
        </div>
        <div>
          <strong>{published.length}</strong>
          <span>已发布</span>
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

      <section className="module-grid">
        {published.map((playlist) => (
          <PlaylistCard key={playlist.id} playlist={playlist} />
        ))}
      </section>

      <section className="surface">
        <div className="section-title">
          <div>
            <h2>最近本地缓存</h2>
            <p>缓存文件只属于当前账号和当前后端环境。</p>
          </div>
          <Link className="button secondary" href="/playlist">播放器</Link>
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
