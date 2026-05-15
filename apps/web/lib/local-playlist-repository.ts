import type { ImportCacheResponse, ImportPreviewResponse } from "@ai-music-playlist/api-contract";

import { cacheImportItems } from "./api";
import {
  mapImportItemToDraftItem,
  type DraftPlaylistItem,
  type PlaylistDraft,
  type PublishedPlaylistDetail,
  type PublishedPlaylistItem,
  type PublishedPlaylistSummary
} from "./playlist-domain";
import type { DraftMoveDirection, PlaylistRepository } from "./playlist-repository";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type CacheItems = (input: { collectionId: string; itemIds: string[] }) => Promise<ImportCacheResponse>;

const ACTIVE_DRAFT_KEY = "ai_music_active_playlist_draft";
const PUBLISHED_PLAYLISTS_KEY = "ai_music_published_playlists";

const sampleCreatedAt = "1970-01-01T00:00:00.000Z";

const samplePlaylists: PublishedPlaylistDetail[] = [
  {
    id: "sample-ai-covers",
    title: "AI 翻唱热听",
    description: "编辑先放一组目录样式示例：发布的是目录元信息，真正收听仍要自己缓存。",
    coverUrl: null,
    visibility: "public",
    kind: "music",
    creatorName: "编辑精选",
    sourcePlatforms: ["bilibili"],
    itemCount: 5,
    cachedItemCount: 0,
    isSample: true,
    createdAt: sampleCreatedAt,
    updatedAt: sampleCreatedAt,
    items: [
      {
        id: "sample-ai-covers-1",
        collectionId: null,
        importItemId: null,
        sourceContentId: null,
        platform: "bilibili",
        platformContentId: null,
        title: "雨夜合成器人声",
        sourceUrl: null,
        coverUrl: null,
        ownerName: "AI Music Lab",
        durationSeconds: 212,
        cacheStatus: "uncached",
        position: 1
      },
      {
        id: "sample-ai-covers-2",
        collectionId: null,
        importItemId: null,
        sourceContentId: null,
        platform: "bilibili",
        platformContentId: null,
        title: "旧磁带女声模型",
        sourceUrl: null,
        coverUrl: null,
        ownerName: "Vocal Archive",
        durationSeconds: 184,
        cacheStatus: "uncached",
        position: 2
      }
    ]
  },
  {
    id: "sample-learning-loop",
    title: "学习用背景听单",
    description: "低打扰、节奏稳定，适合验证非歌曲内容也能被整理成听单。",
    coverUrl: null,
    visibility: "public",
    kind: "learning",
    creatorName: "学习播放单",
    sourcePlatforms: ["bilibili"],
    itemCount: 8,
    cachedItemCount: 0,
    isSample: true,
    createdAt: sampleCreatedAt,
    updatedAt: sampleCreatedAt,
    items: [
      {
        id: "sample-learning-loop-1",
        collectionId: null,
        importItemId: null,
        sourceContentId: null,
        platform: "bilibili",
        platformContentId: null,
        title: "45 分钟专注环境音",
        sourceUrl: null,
        coverUrl: null,
        ownerName: "Focus Room",
        durationSeconds: 2700,
        cacheStatus: "uncached",
        position: 1
      }
    ]
  }
];

export interface LocalPlaylistRepositoryOptions {
  storage?: StorageLike;
  cacheItems?: CacheItems;
  now?: () => Date;
}

export function createLocalPlaylistRepository(
  options: LocalPlaylistRepositoryOptions = {},
): PlaylistRepository {
  const storage = options.storage ?? getBrowserStorage();
  const cacheItems = options.cacheItems ?? cacheImportItems;
  const now = options.now ?? (() => new Date());

  function timestamp() {
    return now().toISOString();
  }

  function readActiveDraft(): PlaylistDraft {
    const saved = storage?.getItem(ACTIVE_DRAFT_KEY);

    if (saved) {
      return normalizeDraft(JSON.parse(saved) as PlaylistDraft);
    }

    return createEmptyDraft(timestamp());
  }

  function writeActiveDraft(draft: PlaylistDraft) {
    const normalized = normalizeDraft({
      ...draft,
      updatedAt: timestamp()
    });
    storage?.setItem(ACTIVE_DRAFT_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function readPublishedPlaylists(): PublishedPlaylistDetail[] {
    const saved = storage?.getItem(PUBLISHED_PLAYLISTS_KEY);

    if (!saved) {
      return [];
    }

    return (JSON.parse(saved) as PublishedPlaylistDetail[]).map(normalizePublishedPlaylist);
  }

  function writePublishedPlaylists(playlists: PublishedPlaylistDetail[]) {
    storage?.setItem(PUBLISHED_PLAYLISTS_KEY, JSON.stringify(playlists.map(normalizePublishedPlaylist)));
  }

  return {
    async getActiveDraft() {
      const draft = readActiveDraft();
      storage?.setItem(ACTIVE_DRAFT_KEY, JSON.stringify(draft));
      return draft;
    },

    async saveDraft(input) {
      return writeActiveDraft(input);
    },

    async appendImportPreviewToDraft(preview: ImportPreviewResponse) {
      const draft = readActiveDraft();
      const existingSourceIds = new Set(draft.items.map((item) => item.sourceContentId));
      const nextItems = [...draft.items];

      for (const item of preview.items) {
        if (existingSourceIds.has(item.sourceContentId)) {
          continue;
        }

        nextItems.push(
          mapImportItemToDraftItem({
            collectionId: preview.collectionId,
            item,
            now: timestamp(),
            position: nextItems.length + 1
          }),
        );
        existingSourceIds.add(item.sourceContentId);
      }

      return writeActiveDraft({
        ...draft,
        title: draft.title || preview.title || "未命名听单",
        coverUrl: draft.coverUrl ?? nextItems.find((item) => item.coverUrl)?.coverUrl ?? null,
        items: compactDraftPositions(nextItems)
      });
    },

    async removeDraftItems(ids) {
      const removeIds = new Set(ids);
      const draft = readActiveDraft();

      return writeActiveDraft({
        ...draft,
        items: compactDraftPositions(draft.items.filter((item) => !removeIds.has(item.id)))
      });
    },

    async moveDraftItem(id, direction: DraftMoveDirection) {
      const draft = readActiveDraft();
      const items = [...draft.items].sort((a, b) => a.position - b.position);
      const index = items.findIndex((item) => item.id === id);

      if (index === -1) {
        return draft;
      }

      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= items.length) {
        return draft;
      }

      const current = items[index];
      const target = items[targetIndex];

      if (!current || !target) {
        return draft;
      }

      items[index] = target;
      items[targetIndex] = current;

      return writeActiveDraft({
        ...draft,
        items: compactDraftPositions(items)
      });
    },

    async reorderDraftItems(ids) {
      const draft = readActiveDraft();
      const itemById = new Map(draft.items.map((item) => [item.id, item]));
      const reorderedItems = ids
        .map((id) => itemById.get(id))
        .filter((item): item is DraftPlaylistItem => Boolean(item));
      const reorderedIdSet = new Set(reorderedItems.map((item) => item.id));
      const remainingItems = draft.items.filter((item) => !reorderedIdSet.has(item.id));

      return writeActiveDraft({
        ...draft,
        items: compactDraftPositions([...reorderedItems, ...remainingItems])
      });
    },

    async publishDraft() {
      const draft = readActiveDraft();

      if (!draft.title.trim()) {
        throw new Error("发布前需要给听单起标题。");
      }

      if (draft.items.length === 0) {
        throw new Error("发布前至少添加 1 个视频。");
      }

      const published = buildPublishedFromDraft(draft, timestamp());
      const playlists = [published, ...readPublishedPlaylists().filter((playlist) => playlist.id !== published.id)];
      writePublishedPlaylists(playlists);
      storage?.removeItem(ACTIVE_DRAFT_KEY);
      storage?.setItem(ACTIVE_DRAFT_KEY, JSON.stringify(createEmptyDraft(timestamp())));

      return published;
    },

    async listPublishedPlaylists() {
      return [...readPublishedPlaylists(), ...samplePlaylists].map(toSummary);
    },

    async getPublishedPlaylist(id) {
      return readPublishedPlaylists().find((playlist) => playlist.id === id)
        ?? samplePlaylists.find((playlist) => playlist.id === id)
        ?? null;
    },

    async cachePublishedPlaylistItems(playlistId, itemIds) {
      const itemIdSet = new Set(itemIds);
      const playlists = readPublishedPlaylists();
      const playlist = playlists.find((entry) => entry.id === playlistId);

      if (!playlist) {
        throw new Error("示例听单暂不支持真实缓存，请先发布自己的听单。");
      }

      const groups = new Map<string, PublishedPlaylistItem[]>();

      for (const item of playlist.items) {
        if (!itemIdSet.has(item.id) || !item.collectionId || !item.importItemId) {
          continue;
        }

        const group = groups.get(item.collectionId) ?? [];
        group.push(item);
        groups.set(item.collectionId, group);
      }

      if (groups.size === 0) {
        throw new Error("没有可缓存的真实解析条目。");
      }

      const results: ImportCacheResponse[] = [];

      for (const [collectionId, items] of groups) {
        const result = await cacheItems({
          collectionId,
          itemIds: items.map((item) => item.importItemId).filter(Boolean) as string[]
        });
        results.push(result);
      }

      const cachedItemIds = new Set(itemIds);
      const updatedPlaylist = normalizePublishedPlaylist({
        ...playlist,
        items: playlist.items.map((item) => cachedItemIds.has(item.id) ? { ...item, cacheStatus: "cached" } : item),
        updatedAt: timestamp()
      });
      writePublishedPlaylists(playlists.map((entry) => entry.id === playlistId ? updatedPlaylist : entry));

      return {
        playlist: updatedPlaylist,
        results
      };
    }
  };
}

function getBrowserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}

function createEmptyDraft(now: string): PlaylistDraft {
  return {
    id: createId("draft"),
    title: "",
    description: "",
    coverUrl: null,
    visibility: "public",
    items: [],
    createdAt: now,
    updatedAt: now
  };
}

function createId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}:${randomId}`;
}

function normalizeDraft(draft: PlaylistDraft): PlaylistDraft {
  return {
    ...draft,
    title: draft.title ?? "",
    description: draft.description ?? "",
    coverUrl: draft.coverUrl ?? draft.items.find((item) => item.coverUrl)?.coverUrl ?? null,
    visibility: draft.visibility ?? "public",
    items: compactDraftPositions(draft.items ?? [])
  };
}

function compactDraftPositions(items: DraftPlaylistItem[]) {
  return items
    .slice()
    .map((item, index) => ({
      ...item,
      position: index + 1
    }));
}

function buildPublishedFromDraft(draft: PlaylistDraft, now: string): PublishedPlaylistDetail {
  const items: PublishedPlaylistItem[] = draft.items.map((item) => ({
    id: item.id,
    collectionId: item.collectionId,
    importItemId: item.importItemId,
    sourceContentId: item.sourceContentId,
    platform: item.platform,
    platformContentId: item.platformContentId,
    title: item.title,
    sourceUrl: item.sourceUrl,
    coverUrl: item.coverUrl,
    ownerName: item.ownerName,
    durationSeconds: item.durationSeconds,
    cacheStatus: item.cacheStatus,
    position: item.position
  }));

  return normalizePublishedPlaylist({
    id: createId("playlist"),
    title: draft.title.trim(),
    description: draft.description.trim(),
    coverUrl: draft.coverUrl ?? items.find((item) => item.coverUrl)?.coverUrl ?? null,
    visibility: draft.visibility,
    kind: "music",
    creatorName: "我",
    sourcePlatforms: ["bilibili"],
    itemCount: items.length,
    cachedItemCount: items.filter((item) => item.cacheStatus === "cached").length,
    isSample: false,
    createdAt: now,
    updatedAt: now,
    items
  });
}

function normalizePublishedPlaylist(playlist: PublishedPlaylistDetail): PublishedPlaylistDetail {
  const items = playlist.items
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((item, index) => ({
      ...item,
      position: index + 1
    }));

  return {
    ...playlist,
    coverUrl: playlist.coverUrl ?? items.find((item) => item.coverUrl)?.coverUrl ?? null,
    itemCount: items.length || playlist.itemCount,
    cachedItemCount: items.filter((item) => item.cacheStatus === "cached").length,
    items
  };
}

function toSummary(playlist: PublishedPlaylistDetail): PublishedPlaylistSummary {
  const normalized = normalizePublishedPlaylist(playlist);

  return {
    id: normalized.id,
    title: normalized.title,
    description: normalized.description,
    coverUrl: normalized.coverUrl,
    visibility: normalized.visibility,
    kind: normalized.kind,
    creatorName: normalized.creatorName,
    sourcePlatforms: normalized.sourcePlatforms,
    itemCount: normalized.itemCount,
    cachedItemCount: normalized.cachedItemCount,
    isSample: normalized.isSample,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt
  };
}
