import { describe, expect, it } from "vitest";
import type { PlaylistDetailResponse, PlaylistListResponse } from "@ai-music-playlist/api-contract";

import { createHttpPlaylistRepository } from "./http-playlist-repository";
import type { PlaylistDraft } from "./playlist-domain";

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();

  get length() {
    return this.data.size;
  }

  clear() {
    this.data.clear();
  }

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

const detail: PlaylistDetailResponse = {
  playlist: {
    id: "playlist-1",
    ownerUserId: "user-1",
    ownerDisplayName: "alpha",
    title: "视频听单",
    description: "从 B 站整理",
    coverUrl: null,
    coverItems: ["https://i0.hdslb.com/cover.jpg"],
    visibility: "public",
    sourceTypeSummary: "bilibili",
    itemCount: 1,
    cachedCountForCurrentUser: 0,
    favoritedByCurrentUser: false,
    isOwner: true,
    isEditorial: false,
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z",
    items: [
      {
        id: "item-1",
        playlistId: "playlist-1",
        sourcePlatform: "bilibili",
        sourceUrl: "https://www.bilibili.com/video/BV111",
        sourceContentId: "source-1",
        sourceAuthorName: "UP",
        title: "Song 1",
        coverUrl: null,
        durationSeconds: 120,
        orderIndex: 1,
        cacheStatusForCurrentUser: "not_cached",
        localAudioAssetIdForCurrentUser: null,
        audioUrlForCurrentUser: null,
        createdAt: "2026-05-17T00:00:00.000Z"
      }
    ]
  }
};

describe("http playlist repository", () => {
  it("publishes the browser draft through playlist API endpoints", async () => {
    const calls: string[] = [];
    const repository = createHttpPlaylistRepository({
      storage: new MemoryStorage(),
      api: {
        createPlaylist: async () => {
          calls.push("create");
          return { playlist: { ...detail.playlist, items: [] } };
        },
        addPlaylistItems: async (_playlistId, input) => {
          calls.push(`add:${input.sourceContentIds.join(",")}`);
          return detail;
        },
        getPlaylist: async () => detail,
        listPlaylists: async (): Promise<PlaylistListResponse> => ({
          playlists: [detail.playlist]
        }),
        requestLocalAudioCache: async () => ({
          assetId: "asset-1",
          taskId: "task-1",
          assetStatus: "pending",
          taskStatus: "queued"
        })
      }
    });
    const draft: PlaylistDraft = {
      id: "draft-1",
      title: "视频听单",
      description: "从 B 站整理",
      coverUrl: null,
      visibility: "public",
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:00:00.000Z",
      items: [
        {
          id: "draft-item-1",
          collectionId: "collection-1",
          importItemId: "import-item-1",
          sourceContentId: "source-1",
          platform: "bilibili",
          platformContentId: "BV111",
          title: "Song 1",
          sourceUrl: "https://www.bilibili.com/video/BV111",
          coverUrl: null,
          ownerName: "UP",
          durationSeconds: 120,
          cacheStatus: "uncached",
          position: 1
        }
      ]
    };

    await repository.saveDraft(draft);
    const published = await repository.publishDraft();
    const activeDraft = await repository.getActiveDraft();

    expect(calls).toEqual(["create", "add:source-1"]);
    expect(published.id).toBe("playlist-1");
    expect(published.items[0]?.sourceContentId).toBe("source-1");
    expect(activeDraft.items).toEqual([]);
  });

  it("requests local audio cache by playlist item and source content", async () => {
    const cacheRequests: Array<{ sourceContentId: string; playlistId?: string; playlistItemId?: string }> = [];
    const repository = createHttpPlaylistRepository({
      storage: new MemoryStorage(),
      api: {
        getPlaylist: async () => detail,
        listPlaylists: async () => ({ playlists: [detail.playlist] }),
        createPlaylist: async () => detail,
        addPlaylistItems: async () => detail,
        requestLocalAudioCache: async (input) => {
          cacheRequests.push(input);
          return {
            assetId: "asset-1",
            taskId: "task-1",
            assetStatus: "pending",
            taskStatus: "queued"
          };
        }
      }
    });

    const result = await repository.cachePublishedPlaylistItems("playlist-1", ["item-1"]);

    expect(cacheRequests).toEqual([
      {
        sourceContentId: "source-1",
        playlistId: "playlist-1",
        playlistItemId: "item-1"
      }
    ]);
    expect(result.results[0]?.queuedCount).toBe(1);
  });
});
