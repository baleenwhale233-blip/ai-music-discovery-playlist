"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ImportPreviewResponse, PlaylistDetail } from "@ai-music-playlist/api-contract";

import { LoginPrompt } from "../../../components/login-prompt";
import { PlaylistItemRow } from "../../../components/playlist-item-row";
import {
  deletePlaylistItemFromPlaylist,
  getPlaylist,
  getStoredToken,
  previewImport,
  addPlaylistItems,
  reorderPlaylistItems,
  updatePlaylist
} from "../../../../lib/api";
import type { PublishedPlaylistItem } from "../../../../lib/playlist-domain";

export default function PlaylistManagePage() {
  const params = useParams<{ playlistId: string }>();
  const router = useRouter();
  const playlistId = decodeURIComponent(params.playlistId);
  const [tokenReady, setTokenReady] = useState(false);
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [selectedImportIds, setSelectedImportIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("只有创建者可以管理这张听单。");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hasToken = Boolean(getStoredToken());
    setTokenReady(hasToken);

    if (!hasToken) {
      return;
    }

    void getPlaylist(playlistId)
      .then((result) => {
        setPlaylist(result.playlist);
        setTitle(result.playlist.title);
        setDescription(result.playlist.description ?? "");
        if (!result.playlist.isOwner) {
          setStatus("当前账号不是创建者，不能编辑这张听单。");
        }
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : "读取听单失败"));
  }, [playlistId]);

  async function saveChanges() {
    if (!playlist) {
      return;
    }

    setBusy(true);
    setStatus("正在保存。");

    try {
      const result = await updatePlaylist(playlist.id, {
        title,
        description,
        visibility: playlist.visibility
      });
      setPlaylist(result.playlist);
      setStatus("已保存。");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(itemId: string) {
    if (!playlist) {
      return;
    }

    setBusy(true);
    setStatus("正在删除条目。");

    try {
      const result = await deletePlaylistItemFromPlaylist(playlist.id, itemId);
      setPlaylist(result.playlist);
      setStatus("已删除条目。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  async function parseSource() {
    if (!sourceUrl.trim()) {
      setStatus("先粘贴一个 B 站链接。");
      return;
    }

    setBusy(true);
    setStatus("正在解析来源。");

    try {
      const result = await previewImport({ url: sourceUrl.trim() });
      setPreview(result);
      setSelectedImportIds(new Set(result.items.map((item) => item.id)));
      setStatus(`已解析 ${result.items.length} 个条目。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "解析失败");
    } finally {
      setBusy(false);
    }
  }

  async function addSelectedPreviewItems() {
    if (!playlist || !preview || selectedImportIds.size === 0) {
      return;
    }

    setBusy(true);
    setStatus("正在加入听单。");

    try {
      const sourceContentIds = preview.items
        .filter((item) => selectedImportIds.has(item.id))
        .map((item) => item.sourceContentId);
      const result = await addPlaylistItems(playlist.id, { sourceContentIds });
      setPlaylist(result.playlist);
      setPreview(null);
      setSourceUrl("");
      setSelectedImportIds(new Set());
      setStatus(`已加入 ${sourceContentIds.length} 个条目。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "加入失败");
    } finally {
      setBusy(false);
    }
  }

  async function moveItem(itemId: string, direction: "up" | "down") {
    if (!playlist) {
      return;
    }

    const ids = playlist.items.map((item) => item.id);
    const index = ids.indexOf(itemId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (index === -1 || targetIndex < 0 || targetIndex >= ids.length) {
      return;
    }

    const nextIds = [...ids];
    const current = nextIds[index];
    const target = nextIds[targetIndex];

    if (!current || !target) {
      return;
    }

    nextIds[index] = target;
    nextIds[targetIndex] = current;
    setBusy(true);
    setStatus("正在更新排序。");

    try {
      const result = await reorderPlaylistItems(playlist.id, nextIds);
      setPlaylist(result.playlist);
      setStatus("已更新排序。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "排序失败");
    } finally {
      setBusy(false);
    }
  }

  if (!tokenReady) {
    return <LoginPrompt />;
  }

  if (!playlist) {
    return (
      <main className="mobile-shell create-flow-shell">
        <header className="create-topbar">
          <Link className="topbar-icon" href={`/playlists/${encodeURIComponent(playlistId)}`}>‹</Link>
          <h1>管理听单</h1>
          <span />
        </header>
        <section className="soft-card">
          <p className="ui-note">{status}</p>
        </section>
      </main>
    );
  }

  const canEdit = playlist.isOwner && !busy;

  return (
    <main className="mobile-shell create-flow-shell">
      <header className="create-topbar">
        <Link aria-label="返回详情" className="topbar-icon" href={`/playlists/${encodeURIComponent(playlist.id)}`}>‹</Link>
        <h1>管理听单</h1>
        <button
          className="text-top-action"
          disabled={!canEdit || !title.trim()}
          onClick={() => void saveChanges()}
          type="button"
        >
          保存
        </button>
      </header>

      <section className="draft-form-block">
        <label className="field-label">
          <span>听单标题</span>
          <input
            className="quiet-input"
            disabled={!canEdit}
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </label>
        <label className="field-label">
          <span>简介</span>
          <textarea
            className="quiet-input"
            disabled={!canEdit}
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
        </label>
      </section>

      <section className="draft-section">
        <div className="draft-section-heading">
          <div>
            <h2>添加来源</h2>
            <p>粘贴 B 站视频、收藏夹、播放列表或合集链接，选择条目后加入这张听单。</p>
          </div>
        </div>
        <label className="field-label">
          <span>来源链接</span>
          <textarea
            className="quiet-input link-input"
            disabled={!canEdit}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="粘贴 B 站链接"
            value={sourceUrl}
          />
        </label>
        <div className="toolbar">
          <button className="secondary" disabled={!canEdit || !sourceUrl.trim()} onClick={() => void parseSource()} type="button">
            解析
          </button>
          <button
            className="primary"
            disabled={!canEdit || !preview || selectedImportIds.size === 0}
            onClick={() => void addSelectedPreviewItems()}
            type="button"
          >
            加入选中
          </button>
        </div>
        {preview ? (
          <div className="selectable-result-list">
            {preview.items.map((item) => (
              <button
                className="preview-result-row"
                key={item.id}
                onClick={() => {
                  setSelectedImportIds((current) => {
                    const next = new Set(current);
                    if (next.has(item.id)) {
                      next.delete(item.id);
                    } else {
                      next.add(item.id);
                    }
                    return next;
                  });
                }}
                type="button"
              >
                <span className="result-cover-fallback" />
                <span className="result-copy">
                  <strong>{item.title}</strong>
                  <small>{item.ownerName ?? "未知作者"}</small>
                </span>
                <span aria-hidden="true" className={selectedImportIds.has(item.id) ? "select-dot checked" : "select-dot"} />
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="draft-section">
        <div className="draft-section-heading">
          <div>
            <h2>条目</h2>
            <p>{playlist.items.length} 个条目。使用上移/下移调整顺序。</p>
          </div>
        </div>
        <p className="ui-note">{status}</p>
        <div className="item-list draft-item-list">
          {playlist.items.map((item) => (
            <PlaylistItemRow
              actions={
                playlist.isOwner ? (
                  <>
                    <button className="secondary" disabled={busy} onClick={() => void moveItem(item.id, "up")} type="button">
                      上移
                    </button>
                    <button className="secondary" disabled={busy} onClick={() => void moveItem(item.id, "down")} type="button">
                      下移
                    </button>
                    <button className="danger" disabled={busy} onClick={() => void removeItem(item.id)} type="button">
                      删除
                    </button>
                  </>
                ) : null
              }
              item={toPublishedItem(item)}
              key={item.id}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function toPublishedItem(item: PlaylistDetail["items"][number]): PublishedPlaylistItem {
  return {
    id: item.id,
    collectionId: null,
    importItemId: null,
    sourceContentId: item.sourceContentId,
    platform: "bilibili",
    platformContentId: null,
    title: item.title,
    sourceUrl: item.sourceUrl,
    coverUrl: item.coverUrl,
    ownerName: item.sourceAuthorName,
    durationSeconds: item.durationSeconds,
    cacheStatus: item.cacheStatusForCurrentUser === "cached"
      ? "cached"
      : item.cacheStatusForCurrentUser === "failed"
        ? "failed"
        : item.cacheStatusForCurrentUser === "queued" || item.cacheStatusForCurrentUser === "converting"
          ? "caching"
          : "uncached",
    localAudioAssetId: item.localAudioAssetIdForCurrentUser,
    audioUrl: item.audioUrlForCurrentUser,
    position: item.orderIndex
  };
}
