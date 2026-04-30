import { describe, expect, it } from "vitest";
import type { ImportPreviewResponse } from "@ai-music-playlist/api-contract";

import { createLocalPlaylistRepository } from "./local-playlist-repository";
import { createPlaylistRepository } from "./playlist-repository-factory";

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

const preview: ImportPreviewResponse = {
  collectionId: "collection-1",
  mediaId: "ml123",
  title: "夜跑 AI 合集",
  sourceType: "playlist",
  totalCount: 2,
  items: [
    {
      id: "import-item-1",
      sourceContentId: "source-1",
      bvid: "BV111",
      title: "霓虹合成器",
      url: "https://www.bilibili.com/video/BV111",
      coverUrl: "https://i0.hdslb.com/cover-1.jpg",
      ownerName: "Synth Lab",
      durationSeconds: 188,
      isExcluded: false,
      cacheStatus: "uncached"
    },
    {
      id: "import-item-2",
      sourceContentId: "source-2",
      bvid: "BV222",
      title: "午夜人声模型",
      url: "https://www.bilibili.com/video/BV222",
      coverUrl: "https://i0.hdslb.com/cover-2.jpg",
      ownerName: "AI Vocal",
      durationSeconds: 211,
      isExcluded: false,
      cacheStatus: "cached"
    }
  ]
};

describe("local playlist repository", () => {
  it("creates an active draft and appends import preview items without duplicates", async () => {
    const repository = createLocalPlaylistRepository({ storage: new MemoryStorage() });

    await repository.appendImportPreviewToDraft(preview);
    await repository.appendImportPreviewToDraft(preview);
    const draft = await repository.getActiveDraft();

    expect(draft.title).toBe("夜跑 AI 合集");
    expect(draft.coverUrl).toBe("https://i0.hdslb.com/cover-1.jpg");
    expect(draft.items.map((item) => item.sourceContentId)).toEqual(["source-1", "source-2"]);
    expect(draft.items.map((item) => item.position)).toEqual([1, 2]);
    expect(draft.items[0]).toMatchObject({
      collectionId: "collection-1",
      importItemId: "import-item-1",
      title: "霓虹合成器",
      cacheStatus: "uncached"
    });
  });

  it("removes draft items in batches and keeps positions compact", async () => {
    const repository = createLocalPlaylistRepository({ storage: new MemoryStorage() });
    await repository.appendImportPreviewToDraft(preview);
    const draft = await repository.getActiveDraft();
    const firstItem = draft.items[0];
    expect(firstItem).toBeDefined();

    await repository.removeDraftItems([firstItem?.id ?? "missing"]);
    const updated = await repository.getActiveDraft();

    expect(updated.items.map((item) => item.title)).toEqual(["午夜人声模型"]);
    expect(updated.items.map((item) => item.position)).toEqual([1]);
  });

  it("moves draft items up and down", async () => {
    const repository = createLocalPlaylistRepository({ storage: new MemoryStorage() });
    await repository.appendImportPreviewToDraft(preview);
    const draft = await repository.getActiveDraft();
    const secondItem = draft.items[1];
    expect(secondItem).toBeDefined();

    await repository.moveDraftItem(secondItem?.id ?? "missing", "up");
    const movedUp = await repository.getActiveDraft();
    const firstMovedItem = movedUp.items[0];
    expect(firstMovedItem).toBeDefined();
    await repository.moveDraftItem(firstMovedItem?.id ?? "missing", "down");
    const movedDown = await repository.getActiveDraft();

    expect(movedUp.items.map((item) => item.title)).toEqual(["午夜人声模型", "霓虹合成器"]);
    expect(movedDown.items.map((item) => item.title)).toEqual(["霓虹合成器", "午夜人声模型"]);
  });

  it("publishes a draft as directory metadata and resets the active draft", async () => {
    const repository = createLocalPlaylistRepository({ storage: new MemoryStorage() });
    const draft = await repository.appendImportPreviewToDraft(preview);
    await repository.saveDraft({
      ...draft,
      title: "夜跑听单",
      description: "适合夜里走路的 AI 音乐目录"
    });

    const published = await repository.publishDraft();
    const activeDraft = await repository.getActiveDraft();
    const detail = await repository.getPublishedPlaylist(published.id);
    const publishedList = await repository.listPublishedPlaylists();

    expect(published).toMatchObject({
      title: "夜跑听单",
      description: "适合夜里走路的 AI 音乐目录",
      visibility: "public",
      itemCount: 2,
      cachedItemCount: 1
    });
    expect(detail?.items.map((item) => item.sourceContentId)).toEqual(["source-1", "source-2"]);
    expect(publishedList.some((playlist) => playlist.id === published.id)).toBe(true);
    expect(activeDraft.items).toEqual([]);
  });

  it("caches published playlist items by collection", async () => {
    const cacheCalls: Array<{ collectionId: string; itemIds: string[] }> = [];
    const repository = createLocalPlaylistRepository({
      storage: new MemoryStorage(),
      cacheItems: async (input) => {
        cacheCalls.push(input);
        return {
          collectionId: input.collectionId,
          cachedCount: input.itemIds.length,
          failedCount: 0,
          playlistItemIds: input.itemIds.map((id) => `playlist-${id}`)
        };
      }
    });
    const draft = await repository.appendImportPreviewToDraft(preview);
    const published = await repository.publishDraft();
    const firstItem = draft.items[0];
    expect(firstItem).toBeDefined();

    await repository.cachePublishedPlaylistItems(published.id, [firstItem?.id ?? "missing"]);

    expect(cacheCalls).toEqual([{ collectionId: "collection-1", itemIds: ["import-item-1"] }]);
  });
});

describe("playlist repository factory", () => {
  it("uses the local repository by default", async () => {
    const repository = createPlaylistRepository({ storage: new MemoryStorage() });

    const draft = await repository.getActiveDraft();

    expect(draft.visibility).toBe("public");
    expect(draft.items).toEqual([]);
  });
});
