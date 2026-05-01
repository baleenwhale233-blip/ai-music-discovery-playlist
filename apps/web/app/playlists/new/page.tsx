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

import { BottomNav } from "../../components/bottom-nav";
import { LoginPrompt } from "../../components/login-prompt";
import { PageHeader } from "../../components/page-header";
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
  const [status, setStatus] = useState("听单草稿会先保存在当前浏览器，后续可替换为后端草稿接口。");
  const [busy, setBusy] = useState(false);
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
      <main className="mobile-shell with-bottom-nav">
        <PageHeader eyebrow="New Playlist" title="添加听单" />
        <section className="surface">
          <p className="lead">正在读取草稿。</p>
        </section>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="mobile-shell with-bottom-nav">
      <PageHeader
        actionHref="/playlists/new/add"
        actionLabel="添加视频"
        description="先添加链接，解析后回到这里统一删除、批量管理、排序，再发布目录元信息。"
        eyebrow="Draft"
        title="添加听单"
      />

      <section className="surface draft-editor">
        <label>
          <span>听单标题</span>
          <input
            onChange={(event) => void saveDraft({ ...draft, title: event.target.value })}
            placeholder="给这组 AI 音乐起个名字"
            value={draft.title}
          />
        </label>
        <label>
          <span>简介</span>
          <textarea
            onChange={(event) => void saveDraft({ ...draft, description: event.target.value })}
            placeholder="一句话告诉别人这组目录适合什么场景"
            value={draft.description}
          />
        </label>
      </section>

      <section className="surface">
        <div className="section-title">
          <div>
            <h2>等待保存的听单列表</h2>
            <p>{draft.items.length} 条，已选择 {selectedIds.size} 条</p>
          </div>
          <Link className="button primary" href="/playlists/new/add">添加视频</Link>
        </div>

        <div className="toolbar">
          <button className="secondary" disabled={draft.items.length === 0 || busy} onClick={() => setSelectedIds(new Set(draft.items.map((item) => item.id)))}>
            全选
          </button>
          <button className="secondary" disabled={selectedIds.size === 0 || busy} onClick={() => setSelectedIds(new Set())}>
            取消
          </button>
          <button className="danger" disabled={selectedIds.size === 0 || busy} onClick={() => void removeSelected()}>
            删除已选
          </button>
        </div>

        <div className="status">{status}</div>

        {draft.items.length === 0 ? (
          <div className="empty-state">
            <h2>还没有视频</h2>
            <p className="lead">先添加一个 B 站单条、合集或收藏夹链接，解析后会回到这里。</p>
            <Link className="button primary" href="/playlists/new/add">添加视频</Link>
          </div>
        ) : (
          <DndContext collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)} sensors={sensors}>
            <SortableContext items={draft.items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <div className="item-list">
                {draft.items.map((item) => (
                  <SortableDraftItem
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
        )}
      </section>

      <section className="publish-bar">
        <div>
          <strong>{draft.title || "未命名听单"}</strong>
          <span>{draft.items.length} 条目录项</span>
        </div>
        <button disabled={busy || draft.items.length === 0 || !draft.title.trim()} onClick={() => void publishDraft()}>
          发布听单
        </button>
      </section>

      <BottomNav />
    </main>
  );
}

function SortableDraftItem(props: {
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
        selectable
        actions={(
          <>
            <button
              aria-label={`拖拽排序 ${props.item.title}`}
              className="drag-handle"
              disabled={props.busy}
              type="button"
              {...attributes}
              {...listeners}
            >
              ⋮⋮
            </button>
          </>
        )}
      />
    </div>
  );
}
