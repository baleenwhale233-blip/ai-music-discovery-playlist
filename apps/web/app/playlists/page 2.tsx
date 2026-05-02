"use client";

import { useEffect, useState } from "react";

import { BottomNav } from "../components/bottom-nav";
import { LoginPrompt } from "../components/login-prompt";
import { PageHeader } from "../components/page-header";
import { PlaylistCard } from "../components/playlist-card";
import { getStoredToken } from "../../lib/api";
import { createPlaylistRepository } from "../../lib/playlist-repository-factory";
import type { PublishedPlaylistSummary } from "../../lib/playlist-domain";

export default function PlaylistsPage() {
  const [tokenReady, setTokenReady] = useState(false);
  const [playlists, setPlaylists] = useState<PublishedPlaylistSummary[]>([]);

  useEffect(() => {
    const hasToken = Boolean(getStoredToken());
    setTokenReady(hasToken);

    if (!hasToken) {
      return;
    }

    void createPlaylistRepository()
      .listPublishedPlaylists()
      .then(setPlaylists)
      .catch(() => setPlaylists([]));
  }, []);

  if (!tokenReady) {
    return <LoginPrompt />;
  }

  const featured = playlists[0] ?? null;
  const secondary = playlists.slice(1);

  return (
    <main className="mobile-shell with-bottom-nav">
      <PageHeader
        actionHref="/playlists/new"
        actionLabel="添加听单"
        description="广场只展示目录元信息。想真正收听时，再把条目保存成你自己的本地音频。"
        eyebrow="Playlist Square"
        title="听单"
      />

      {featured ? <PlaylistCard featured playlist={featured} /> : null}

      <section className="module-grid" aria-label="听单广场">
        {secondary.map((playlist, index) => (
          <PlaylistCard featured={index % 5 === 2} key={playlist.id} playlist={playlist} />
        ))}
      </section>

      <section className="surface compact-section">
        <h2>本地缓存才会播放</h2>
        <p className="lead">发布不会共享音频文件。每个人看到的是目录，需要自己主动缓存后，才进入真实播放器。</p>
      </section>

      <BottomNav />
    </main>
  );
}
