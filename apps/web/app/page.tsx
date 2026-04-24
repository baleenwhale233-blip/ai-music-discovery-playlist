"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ImportPreviewItem, ImportPreviewResponse, LocalAudioPlaylistResponse } from "@ai-music-playlist/api-contract";

import { buildMediaUrl, cacheImportItems, getLocalAudioPlaylist, getStoredToken, previewImport } from "../lib/api";

export default function ImportPage() {
  const [tokenReady, setTokenReady] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [playlist, setPlaylist] = useState<LocalAudioPlaylistResponse | null>(null);
  const [status, setStatus] = useState("准备导入 B 站单条、合集或收藏夹链接。");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTokenReady(Boolean(getStoredToken()));
  }, []);

  async function refreshPlaylist() {
    if (!getStoredToken()) {
      return;
    }

    setPlaylist(await getLocalAudioPlaylist());
  }

  useEffect(() => {
    void refreshPlaylist().catch(() => undefined);
  }, []);

  async function handlePreview() {
    if (!sourceUrl.trim()) {
      setStatus("先贴入一个 B 站链接。");
      return;
    }

    setBusy(true);
    setStatus("正在解析目录，只拿候选数据，不会自动缓存。");

    try {
      const result = await previewImport({
        url: sourceUrl.trim()
      });
      setPreview(result);
      setSelectedIds(new Set());
      setStatus(`已解析 ${result.items.length} / ${result.totalCount} 条：${result.title ?? result.mediaId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "解析失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleCacheSelected() {
    if (!preview || selectedIds.size === 0) {
      setStatus("先选择要缓存的候选。");
      return;
    }

    setBusy(true);
    setStatus(`正在缓存 ${selectedIds.size} 条，先串行执行，方便排查失败原因。`);

    try {
      const result = await cacheImportItems({
        collectionId: preview.collectionId,
        itemIds: Array.from(selectedIds)
      });
      setPreview({
        ...preview,
        items: preview.items.filter((item) => !selectedIds.has(item.id))
      });
      setSelectedIds(new Set());
      await refreshPlaylist();
      setStatus(`缓存完成：成功 ${result.cachedCount} 条，失败 ${result.failedCount} 条。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "缓存失败");
    } finally {
      setBusy(false);
    }
  }

  function toggleCandidate(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(preview?.items.map((item) => item.id) ?? []));
  }

  function invertSelection() {
    setSelectedIds((current) => new Set((preview?.items ?? []).filter((item) => !current.has(item.id)).map((item) => item.id)));
  }

  function removeSelectedCandidates() {
    if (!preview || selectedIds.size === 0) {
      return;
    }

    setPreview({
      ...preview,
      items: preview.items.filter((item) => !selectedIds.has(item.id))
    });
    setStatus(`已从当前候选列表移除 ${selectedIds.size} 条。`);
    setSelectedIds(new Set());
  }

  if (!tokenReady) {
    return (
      <main className="app-shell">
        <section className="login-card panel">
          <p className="eyebrow">Alpha</p>
          <h1>先登录，再整理你的本地听单。</h1>
          <p className="lead">正式产品端已经和后台/debug 分开。登录后导入链接、筛选候选、缓存音频都会按你的账号隔离。</p>
          <Link className="button" href="/login">进入 Alpha 登录</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <Topbar />
      <section className="hero">
        <p className="eyebrow">Mobile Web First</p>
        <h1>把 B 站目录整理成真正能听的本地听单。</h1>
        <p className="lead">先拿到候选，再由你决定缓存哪几首。这里接的是正式 `/api/v1`，clean-room 只保留作回归样本。</p>
      </section>

      <div className="grid">
        <section className="panel">
          <h2>导入目录</h2>
          <textarea
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="贴入 B 站单条、合集、收藏夹或 /list/ml... 链接"
          />
          <div className="actions">
            <button disabled={busy} onClick={handlePreview}>解析候选</button>
            <button className="secondary" disabled={busy || !preview?.items.length} onClick={selectAll}>全选</button>
            <button className="secondary" disabled={busy || !preview?.items.length} onClick={invertSelection}>反选</button>
            <button className="danger" disabled={busy || selectedIds.size === 0} onClick={removeSelectedCandidates}>删除已选</button>
            <button className="secondary" disabled={busy || selectedIds.size === 0} onClick={handleCacheSelected}>缓存已选</button>
          </div>
          <div className="status">{status}</div>
          <p className="muted">当前选择：{selectedIds.size} / {preview?.items.length ?? 0}</p>
          <div className="list">
            {(preview?.items ?? []).map((item) => (
              <CandidateRow
                checked={selectedIds.has(item.id)}
                item={item}
                key={item.id}
                onToggle={toggleCandidate}
              />
            ))}
          </div>
        </section>

        <section className="panel subtle">
          <h2>听单快照</h2>
          <p className="muted">已缓存 {playlist?.playlist.cachedItemCount ?? 0} / {playlist?.playlist.itemCount ?? 0} 条。</p>
          <div className="list">
            {(playlist?.items ?? []).slice(0, 6).map((item) => (
              <div className="row playlist-row" key={item.id}>
                {item.coverUrl ? <img className="thumb" src={buildMediaUrl(item.coverUrl) ?? ""} alt="" /> : <div className="thumb" />}
                <div>
                  <div className="title">{item.title}</div>
                  <p className="muted">{item.status === "ready" ? "已缓存" : "未就绪"}</p>
                </div>
              </div>
            ))}
          </div>
          <Link className="button secondary" href="/playlist">打开播放器</Link>
        </section>
      </div>
    </main>
  );
}

function Topbar() {
  return (
    <nav className="topbar">
      <Link className="brand" href="/">
        <span className="brand-mark">AI Music</span>
        <strong>本地听单</strong>
      </Link>
      <div className="nav">
        <Link href="/">导入</Link>
        <Link className="secondary" href="/playlist">听单</Link>
      </div>
    </nav>
  );
}

function CandidateRow(props: {
  checked: boolean;
  item: ImportPreviewItem;
  onToggle: (id: string, checked: boolean) => void;
}) {
  const coverUrl = buildMediaUrl(props.item.coverUrl);

  return (
    <article className="row">
      <input
        aria-label="选择候选"
        checked={props.checked}
        className="check"
        onChange={(event) => props.onToggle(props.item.id, event.target.checked)}
        type="checkbox"
      />
      {coverUrl ? <img className="thumb" src={coverUrl} alt="" /> : <div className="thumb" />}
      <div>
        <div className="title">{props.item.title}</div>
        <p className="muted">{props.item.ownerName ?? "未知 UP"} / {props.item.durationSeconds ?? "未知"} 秒 / {props.item.cacheStatus}</p>
      </div>
    </article>
  );
}
