"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ImportPreviewItem, ImportPreviewResponse } from "@ai-music-playlist/api-contract";

import { LoginPrompt } from "../../../components/login-prompt";
import { buildMediaUrl, getStoredToken, previewImport } from "../../../../lib/api";
import { createPlaylistRepository } from "../../../../lib/playlist-repository-factory";
import { visibleSourceOptions, type VisibleSourceId } from "../../../../lib/source-options";

export default function AddPlaylistVideoPage() {
  const router = useRouter();
  const repository = useMemo(() => createPlaylistRepository(), []);
  const [tokenReady, setTokenReady] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [status, setStatus] = useState("粘贴 B 站链接后开始解析。YouTube 先作为实验来源预留。");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setTokenReady(Boolean(getStoredToken()));
  }, []);

  async function handlePreview() {
    if (!sourceUrl.trim()) {
      setStatus("先贴入一个 B 站链接。");
      return;
    }

    setBusy(true);
    setStatus("正在解析链接。");

    try {
      const nextPreview = await previewImport({ url: sourceUrl.trim() });
      setPreview(nextPreview);
      setSelectedItemIds(new Set(nextPreview.items.map((item) => item.id)));
      setStatus(`已解析 ${nextPreview.items.length} 个条目，可先取消不想加入的内容。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "解析失败");
      if (!getStoredToken()) {
        setTokenReady(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function addSelectedItems() {
    if (!preview || selectedItemIds.size === 0) {
      return;
    }

    setBusy(true);
    setStatus("正在加入听单草稿。");

    try {
      const selectedItems = preview.items.filter((item) => selectedItemIds.has(item.id));
      await repository.appendImportPreviewToDraft({
        ...preview,
        items: selectedItems,
        totalCount: selectedItems.length
      });
      router.push("/playlists/new");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "加入草稿失败");
      if (!getStoredToken()) {
        setTokenReady(false);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!tokenReady) {
    return <LoginPrompt />;
  }

  if (preview) {
    return (
      <main className="mobile-shell create-flow-shell">
        <AddTopBar
          actionLabel="全选"
          backHref="/playlists/new"
          onAction={() => setSelectedItemIds(new Set(preview.items.map((item) => item.id)))}
          title="解析结果"
        />

        <section className="collection-preview-card">
          <div className="collection-art">
            <AbstractCover />
          </div>
          <div>
            <h2>{preview.title || "未命名合集"}</h2>
            <p><SourceBadge id="bilibili" /> B站</p>
            <p>共 {preview.items.length} 个条目</p>
            <p>包含来自 B站 的内容</p>
          </div>
        </section>

        <section className="draft-section">
          <h2>待加入条目</h2>
          <div className="selectable-result-list">
            {preview.items.map((item) => (
              <PreviewResultRow
                checked={selectedItemIds.has(item.id)}
                item={item}
                key={item.id}
                onToggle={(id, checked) => {
                  setSelectedItemIds((current) => {
                    const next = new Set(current);
                    if (checked) {
                      next.add(id);
                    } else {
                      next.delete(id);
                    }
                    return next;
                  });
                }}
              />
            ))}
          </div>
        </section>

        <section className="flow-action-bar">
          <button className="pill-action secondary-action" disabled={busy} onClick={() => setPreview(null)} type="button">
            取消
          </button>
          <button
            className="pill-action primary-action"
            disabled={busy || selectedItemIds.size === 0}
            onClick={() => void addSelectedItems()}
            type="button"
          >
            添加 {selectedItemIds.size} 个条目
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="mobile-shell create-flow-shell">
      <AddTopBar actionLabel="帮助" backHref="/playlists/new" title="从链接添加" />

      <section className="draft-form-block">
        <label className="field-label">
          <span>添加链接</span>
          <textarea
            autoFocus
            className="quiet-input link-input"
            onChange={(event) => {
              setSourceUrl(event.target.value);
              setPreview(null);
            }}
            placeholder="粘贴 YouTube、B站 等链接"
            value={sourceUrl}
          />
        </label>
        <p className="ui-note">支持单条视频、合集、收藏夹、播放列表</p>
      </section>

      <section className="source-chip-grid" aria-label="支持的来源">
        {visibleSourceOptions.map((source) => (
          <div className={source.status === "available" ? "source-chip" : "source-chip muted"} key={source.id}>
            <SourceBadge id={source.id} />
            <span>{source.label}</span>
          </div>
        ))}
      </section>

      <section className="parse-explainer-card">
        <span className="question-mark">?</span>
        <div>
          <h2>解析后将发生什么</h2>
          <ul>
            <li>识别来源与条目</li>
            <li>提取标题、封面与数量</li>
            <li>返回草稿页继续编辑</li>
          </ul>
        </div>
      </section>

      <p className="ui-note">{status}</p>

      <section className="flow-action-bar single">
        <button className="pill-action primary-action" disabled={busy || !sourceUrl.trim()} onClick={() => void handlePreview()} type="button">
          开始解析
        </button>
      </section>
    </main>
  );
}

function AddTopBar(props: {
  actionLabel?: string;
  backHref: string;
  onAction?: () => void;
  title: string;
}) {
  return (
    <header className="create-topbar">
      <Link aria-label="返回" className="topbar-icon" href={props.backHref}>
        <BackIcon />
      </Link>
      <h1>{props.title}</h1>
      {props.onAction ? (
        <button className="text-top-action" onClick={props.onAction} type="button">
          {props.actionLabel}
        </button>
      ) : (
        <span className="text-top-action">{props.actionLabel}</span>
      )}
    </header>
  );
}

function PreviewResultRow(props: {
  checked: boolean;
  item: ImportPreviewItem;
  onToggle: (id: string, checked: boolean) => void;
}) {
  const coverUrl = buildMediaUrl(props.item.coverUrl);

  return (
    <button
      className="preview-result-row"
      onClick={() => props.onToggle(props.item.id, !props.checked)}
      type="button"
    >
      {coverUrl ? <img alt="" src={coverUrl} /> : <span className="result-cover-fallback" />}
      <span className="result-copy">
        <strong>{props.item.title}</strong>
        <small>{formatDuration(props.item.durationSeconds)} · B站</small>
      </span>
      <span aria-hidden="true" className={props.checked ? "select-dot checked" : "select-dot"}>
        {props.checked ? <CheckIcon /> : null}
      </span>
    </button>
  );
}

function formatDuration(durationSeconds: number | null) {
  if (!durationSeconds) {
    return "未知时长";
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.floor(durationSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function SourceBadge(props: { id: VisibleSourceId }) {
  if (props.id === "youtube") {
    return <span className="source-badge youtube">▶</span>;
  }

  return <span className="source-badge bilibili">B</span>;
}

function BackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function AbstractCover() {
  return (
    <div className="abstract-cover" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}
