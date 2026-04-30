import type { ImportPreviewItem } from "@ai-music-playlist/api-contract";

export type PlaylistCacheStatus = "uncached" | "caching" | "cached" | "failed";
export type PlaylistVisibility = "public" | "private";
export type PlaylistKind = "music" | "learning" | "mixed";
export type PlaylistDataSource = "local" | "http";

export interface DraftPlaylistItem {
  id: string;
  collectionId: string;
  importItemId: string;
  sourceContentId: string;
  platform: "bilibili";
  platformContentId: string;
  title: string;
  sourceUrl: string;
  coverUrl: string | null;
  ownerName: string | null;
  durationSeconds: number | null;
  cacheStatus: PlaylistCacheStatus;
  position: number;
}

export interface PlaylistDraft {
  id: string;
  title: string;
  description: string;
  coverUrl: string | null;
  visibility: PlaylistVisibility;
  items: DraftPlaylistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PublishedPlaylistItem {
  id: string;
  collectionId: string | null;
  importItemId: string | null;
  sourceContentId: string | null;
  platform: "bilibili";
  platformContentId: string | null;
  title: string;
  sourceUrl: string | null;
  coverUrl: string | null;
  ownerName: string | null;
  durationSeconds: number | null;
  cacheStatus: PlaylistCacheStatus;
  position: number;
}

export interface PublishedPlaylistSummary {
  id: string;
  title: string;
  description: string;
  coverUrl: string | null;
  visibility: PlaylistVisibility;
  kind: PlaylistKind;
  creatorName: string;
  sourcePlatforms: Array<"bilibili">;
  itemCount: number;
  cachedItemCount: number;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublishedPlaylistDetail extends PublishedPlaylistSummary {
  items: PublishedPlaylistItem[];
}

export function mapImportItemToDraftItem(input: {
  collectionId: string;
  item: ImportPreviewItem;
  position: number;
  now: string;
}): DraftPlaylistItem {
  return {
    id: `draft-item:${input.item.sourceContentId}`,
    collectionId: input.collectionId,
    importItemId: input.item.id,
    sourceContentId: input.item.sourceContentId,
    platform: "bilibili",
    platformContentId: input.item.bvid,
    title: input.item.title,
    sourceUrl: input.item.url,
    coverUrl: input.item.coverUrl,
    ownerName: input.item.ownerName,
    durationSeconds: input.item.durationSeconds,
    cacheStatus: input.item.cacheStatus,
    position: input.position
  };
}
