"use client";

import Link from "next/link";
import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { LoginPrompt } from "../../components/login-prompt";
import { PlaylistItemRow } from "../../components/playlist-item-row";
import { getStoredToken } from "../../../lib/api";
import type { DraftPlaylistItem, PlaylistDraft } from "../../../lib/playlist-domain";
import { createPlaylistRepository } from "../../../lib/playlist-repository-factory";

export default function NewPlaylistPage() {
  const router = useRouter();
  const repository = useMemo(() => createPlaylistRepository(), []);
  const [tokenReady, setTokenReady] = useState(false);
  const [draft, setDraft] = useState<PlaylistDraft | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("听单草稿会先保存在当前浏览器。");
  const [busy, setBusy] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 180,
        tolerance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    }),
  );

  useEffect(() => {
    const hasToken = Boolean(getStoredToken());
    setTokenReady(hasToken);

    if (!hasToken) {
      return;
    }

    void repository.getActiveDraft().then(setDraft).catch((error) => {
      setStatus(error instanceof Error ? error.message : "读取草稿失败");
    });
  }, [repository]);

  async function saveDraft(nextDraft: PlaylistDraft) {
    setDraft(nextDraft);
    setDraft(await repository.saveDraft(nextDraft));
  }

  async function removeSelected() {
    if (selectedIds.size === 0) {
      return;
    }

    setBusy(true);

    try {
      setDraft(await repository.removeDraftItems(Array.from(selectedIds)));
      setSelectedIds(new Set());
      setStatus("已从草稿移除选中条目。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (!draft || !event.over || event.active.id === event.over.id) {
      return;
    }

    const oldIndex = draft.items.findIndex((item) => item.id === event.active.id);
    const newIndex = draft.items.findIndex((item) => item.id === event.over?.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reorderedItems = arrayMove(draft.items, oldIndex, newIndex);
    const optimisticDraft = {
      ...draft,
      items: reorderedItems.map((item, index) => ({
        ...item,
        position: index + 1
      }))
    };
    setDraft(optimisticDraft);

    try {
      setDraft(await repository.reorderDraftItems(reorderedItems.map((item) => item.id)));
      setStatus("已更新排序。");
    } catch (error) {
      setDraft(draft);
      setStatus(error instanceof Error ? error.message : "拖拽排序失败，请稍后重试。");
    }
  }

  async function publishDraft() {
    if (!draft) {
      return;
    }

    setBusy(true);
    setStatus("正在发布目录元信息，不会公开音频文件。");

    try {
      await repository.saveDraft(draft);
      const published = await repository.publishDraft();
      router.push(`/playlists/${encodeURIComponent(published.id)}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "发布失败");
    } finally {
      setBusy(false);
    }
  }

  if (!tokenReady) {
    return <LoginPrompt />;
  }

  if (!draft) {
    return (
      <main className="mobile-shell create-flow-shell">
        <CreateTopBar title="创建听单" closeHref="/playlists" canPublish={false} />
        <section className="soft-card">
          <p className="ui-note">正在读取草稿。</p>
        </section>
      </main>
    );
  }

  const hasItems = draft.items.length > 0;
  const sourceCount = new Set(draft.items.map((item) => item.collectionId)).size;

  return (
    <main className="mobile-shell create-flow-shell">
      <CreateTopBar
        canPublish={hasItems && Boolean(draft.title.trim()) && !busy}
        closeHref="/playlists"
        onPublish={() => void publishDraft()}
        title="创建听单"
      />

      <section className="draft-form-block">
        <label className="field-label">
          <span>听单标题</span>
          <input
            className="quiet-input"
            onChange={(event) => void saveDraft({ ...draft, title: event.target.value })}
            placeholder="为你的听单起个名字"
            value={draft.title}
          />
        </label>
        <label className="field-label">
          <span>简介 <em>（可选）</em></span>
          <span className="textarea-shell">
            <textarea
              className="quiet-input"
              maxLength={200}
              onChange={(event) => void saveDraft({ ...draft, description: event.target.value })}
              placeholder="介绍一下这份听单的主题、用途或灵感..."
              value={draft.description}
            />
            <span className="char-count">{draft.description.length}/200</span>
          </span>
        </label>
      </section>

      {!hasItems ? (
        <>
          <section className="draft-section">
            <h2>添加内容</h2>
            <div className="option-list">
              <Link className="option-row" href="/playlists/new/add">
                <span className="option-icon option-icon-link"><LinkIcon /></span>
                <span>
                  <strong>从链接添加</strong>
                  <small>B站、YouTube</small>
                </span>
                <ChevronIcon />
              </Link>
            </div>
          </section>

          <section className="draft-section">
            <h2>待保存条目</h2>
            <div className="empty-playlist-card">
              <OrbitIllustration />
              <strong>还没有内容</strong>
              <span>先添加链接</span>
            </div>
          </section>
        </>
      ) : (
        <section className="draft-section">
          <div className="draft-section-heading">
            <div>
              <h2>管理条目</h2>
              <p>已添加 {draft.items.length} 个条目 · {sourceCount} 个来源</p>
            </div>
            <div className="draft-tools">
              <button className="chip-button" disabled={busy} onClick={() => setStatus("长按条目右侧手柄即可排序。")} type="button">
                <SortIcon />
                排序
              </button>
              <button
                className={batchMode ? "chip-button active" : "chip-button"}
                disabled={busy}
                onClick={() => {
                  setBatchMode((current) => !current);
                  setSelectedIds(new Set());
                }}
                type="button"
              >
                <BatchIcon />
                批量管理
              </button>
            </div>
          </div>

          <p className="ui-note">{status}</p>

          {batchMode ? (
            <div className="batch-toolbar">
              <button className="secondary" disabled={busy} onClick={() => setSelectedIds(new Set(draft.items.map((item) => item.id)))} type="button">
                全选
              </button>
              <button className="secondary" disabled={busy || selectedIds.size === 0} onClick={() => setSelectedIds(new Set())} type="button">
                取消选择
              </button>
              <button className="danger" disabled={busy || selectedIds.size === 0} onClick={() => void removeSelected()} type="button">
                删除已选
              </button>
            </div>
          ) : null}

          <DndContext collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)} sensors={sensors}>
            <SortableContext items={draft.items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <div className="item-list draft-item-list">
                {draft.items.map((item) => (
                  <SortableDraftItem
                    batchMode={batchMode}
                    busy={busy}
                    checked={selectedIds.has(item.id)}
                    item={item}
                    key={item.id}
                    setSelectedIds={setSelectedIds}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>
      )}

      <section className="flow-action-bar">
        {hasItems ? (
          <Link className="pill-action secondary-action" href="/playlists/new/add">
            <PlusIcon />
            继续添加
          </Link>
        ) : (
          <Link className="pill-action primary-action" href="/playlists/new/add">
            <PlusIcon />
            添加内容
          </Link>
        )}
        <button
          className={hasItems ? "pill-action primary-action" : "pill-action disabled-action"}
          disabled={busy || !hasItems || !draft.title.trim()}
          onClick={() => void publishDraft()}
          type="button"
        >
          <SendIcon />
          发布听单
        </button>
      </section>
    </main>
  );
}

function CreateTopBar(props: {
  canPublish: boolean;
  closeHref: string;
  onPublish?: () => void;
  title: string;
}) {
  return (
    <header className="create-topbar">
      <Link aria-label="关闭" className="topbar-icon" href={props.closeHref}>
        <CloseIcon />
      </Link>
      <h1>{props.title}</h1>
      <button
        aria-label="发布听单"
        className="topbar-icon confirm"
        disabled={!props.canPublish}
        onClick={props.onPublish}
        type="button"
      >
        <CheckIcon />
      </button>
    </header>
  );
}

function SortableDraftItem(props: {
  batchMode: boolean;
  busy: boolean;
  checked: boolean;
  item: DraftPlaylistItem;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({ id: props.item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div className={isDragging ? "sortable-item dragging" : "sortable-item"} ref={setNodeRef} style={style}>
      <PlaylistItemRow
        checked={props.checked}
        item={props.item}
        onToggle={(id, checked) => {
          props.setSelectedIds((current) => {
            const next = new Set(current);
            if (checked) {
              next.add(id);
            } else {
              next.delete(id);
            }
            return next;
          });
        }}
        selectable={props.batchMode}
        actions={(
          <button
            aria-label={`拖拽排序 ${props.item.title}`}
            className="drag-handle"
            disabled={props.busy}
            type="button"
            {...attributes}
            {...listeners}
          >
            <GripIcon />
          </button>
        )}
      />
    </div>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 13l5 5L20 6" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M9.5 14.5l5-5" />
      <path d="M8 11a4 4 0 0 1 0-5.5l1-1a4 4 0 0 1 5.5 5.5" />
      <path d="M16 13a4 4 0 0 1 0 5.5l-1 1A4 4 0 0 1 9.5 14" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" className="chevron-icon" viewBox="0 0 24 24">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8 4v14M5 15l3 3 3-3" />
      <path d="M16 20V6M13 9l3-3 3 3" />
    </svg>
  );
}

function BatchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 5h14v14H5z" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M21 3L10 14" />
      <path d="M21 3l-7 18-4-7-7-4z" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6 8h12M6 12h12M6 16h12" />
    </svg>
  );
}

function OrbitIllustration() {
  return (
    <div className="orbit-illustration" aria-hidden="true">
      <span className="orbit-ring" />
      <span className="orbit-ring second" />
      <span className="orbit-dot" />
      <span className="orbit-star" />
    </div>
  );
}
