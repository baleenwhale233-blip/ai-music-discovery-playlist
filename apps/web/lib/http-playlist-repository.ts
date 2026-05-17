import type {
  ImportCacheResponse,
  LocalAudioCacheRequestCreateResponse,
  PlaylistDetail,
  PlaylistDetailResponse,
  PlaylistSummary
} from "@ai-music-playlist/api-contract";

import {
  addPlaylistItems,
  createPlaylist,
  getPlaylist,
  listPlaylists,
  requestLocalAudioCache
} from "./api";
import { createLocalPlaylistRepository, type LocalPlaylistRepositoryOptions } from "./local-playlist-repository";
import type {
  PlaylistDraft,
  PublishedPlaylistDetail,
  PublishedPlaylistItem,
  PublishedPlaylistSummary
} from "./playlist-domain";
import type { PlaylistRepository } from "./playlist-repository";

interface HttpPlaylistApi {
  listPlaylists: typeof listPlaylists;
  getPlaylist: typeof getPlaylist;
  createPlaylist: typeof createPlaylist;
  addPlaylistItems: typeof addPlaylistItems;
  requestLocalAudioCache: typeof requestLocalAudioCache;
}

export interface HttpPlaylistRepositoryOptions extends LocalPlaylistRepositoryOptions {
  api?: Partial<HttpPlaylistApi>;
}

const defaultApi: HttpPlaylistApi = {
  listPlaylists,
  getPlaylist,
  createPlaylist,
  addPlaylistItems,
  requestLocalAudioCache
};

export function createHttpPlaylistRepository(options: HttpPlaylistRepositoryOptions = {}): PlaylistRepository {
  const draftRepository = createLocalPlaylistRepository(options);
  const api = {
    ...defaultApi,
    ...(options.api ?? {})
  };

  return {
    getActiveDraft: draftRepository.getActiveDraft,
    saveDraft: draftRepository.saveDraft,
    appendImportPreviewToDraft: draftRepository.appendImportPreviewToDraft,
    removeDraftItems: draftRepository.removeDraftItems,
    moveDraftItem: draftRepository.moveDraftItem,
    reorderDraftItems: draftRepository.reorderDraftItems,

    async publishDraft() {
      const draft = await draftRepository.getActiveDraft();

      if (!draft.title.trim()) {
        throw new Error("发布前需要给听单起标题。");
      }

      if (draft.items.length === 0) {
        throw new Error("发布前至少添加 1 个视频。");
      }

      const created = await api.createPlaylist({
        title: draft.title.trim(),
        description: draft.description.trim(),
        visibility: draft.visibility
      });
      const detail = draft.items.length > 0
        ? await api.addPlaylistItems(created.playlist.id, {
          sourceContentIds: draft.items.map((item) => item.sourceContentId)
        })
        : created;
      await draftRepository.saveDraft(createEmptyDraft(new Date().toISOString()));

      return toPublishedDetail(detail.playlist);
    },

    async listPublishedPlaylists() {
      const response = await api.listPlaylists();

      return response.playlists.map(toPublishedSummary);
    },

    async getPublishedPlaylist(id) {
      try {
        const response = await api.getPlaylist(id);

        return toPublishedDetail(response.playlist);
      } catch {
        return null;
      }
    },

    async cachePublishedPlaylistItems(playlistId, itemIds) {
      const detail = await api.getPlaylist(playlistId);
      const itemIdSet = new Set(itemIds);
      const selectedItems = detail.playlist.items.filter((item) => itemIdSet.has(item.id));
      const results: ImportCacheResponse[] = [];

      for (const item of selectedItems) {
        const result = await api.requestLocalAudioCache({
          sourceContentId: item.sourceContentId,
          playlistId,
          playlistItemId: item.id
        });
        results.push(toImportCacheResult(item.id, result));
      }

      const refreshed = await api.getPlaylist(playlistId);

      return {
        playlist: toPublishedDetail(refreshed.playlist),
        results
      };
    }
  };
}

function toImportCacheResult(
  playlistItemId: string,
  response: LocalAudioCacheRequestCreateResponse,
): ImportCacheResponse {
  return {
    collectionId: "playlist",
    cachedCount: response.taskStatus === "queued" ? 1 : 0,
    failedCount: response.taskStatus === "failed" ? 1 : 0,
    queuedCount: response.taskStatus === "queued" ? 1 : 0,
    playlistItemIds: [playlistItemId],
    assetIds: [response.assetId],
    taskIds: [response.taskId]
  };
}

function toPublishedSummary(playlist: PlaylistSummary): PublishedPlaylistSummary {
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

function toPublishedDetail(playlist: PlaylistDetail): PublishedPlaylistDetail {
  return {
    ...toPublishedSummary(playlist),
    items: playlist.items.map(toPublishedItem)
  };
}

function toPublishedItem(item: PlaylistDetailResponse["playlist"]["items"][number]): PublishedPlaylistItem {
  return {
    id: item.id,
    collectionId: null,
    importItemId: null,
    sourceContentId: item.sourceContentId,
    platform: item.sourcePlatform === "bilibili" ? "bilibili" : "bilibili",
    platformContentId: null,
    title: item.title,
    sourceUrl: item.sourceUrl,
    coverUrl: item.coverUrl,
    ownerName: item.sourceAuthorName,
    durationSeconds: item.durationSeconds,
    cacheStatus: toPlaylistCacheStatus(item.cacheStatusForCurrentUser),
    localAudioAssetId: item.localAudioAssetIdForCurrentUser,
    audioUrl: item.audioUrlForCurrentUser,
    position: item.orderIndex
  };
}

function toPlaylistCacheStatus(status: PlaylistDetailResponse["playlist"]["items"][number]["cacheStatusForCurrentUser"]) {
  if (status === "cached") {
    return "cached";
  }

  if (status === "failed") {
    return "failed";
  }

  if (status === "queued" || status === "converting") {
    return "caching";
  }

  return "uncached";
}

function createEmptyDraft(now: string): PlaylistDraft {
  return {
    id: `draft:${now}`,
    title: "",
    description: "",
    coverUrl: null,
    visibility: "public",
    items: [],
    createdAt: now,
    updatedAt: now
  };
}
