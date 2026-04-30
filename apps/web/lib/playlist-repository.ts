import type { ImportCacheResponse, ImportPreviewResponse } from "@ai-music-playlist/api-contract";
import type { PublishedPlaylistDetail, PublishedPlaylistSummary, PlaylistDraft } from "./playlist-domain";

export type DraftMoveDirection = "up" | "down";

export interface CachePublishedPlaylistItemsInput {
  playlistId: string;
  itemIds: string[];
}

export interface PlaylistRepository {
  getActiveDraft(): Promise<PlaylistDraft>;
  saveDraft(input: PlaylistDraft): Promise<PlaylistDraft>;
  appendImportPreviewToDraft(preview: ImportPreviewResponse): Promise<PlaylistDraft>;
  removeDraftItems(ids: string[]): Promise<PlaylistDraft>;
  moveDraftItem(id: string, direction: DraftMoveDirection): Promise<PlaylistDraft>;
  publishDraft(): Promise<PublishedPlaylistDetail>;
  listPublishedPlaylists(): Promise<PublishedPlaylistSummary[]>;
  getPublishedPlaylist(id: string): Promise<PublishedPlaylistDetail | null>;
  cachePublishedPlaylistItems(
    playlistId: string,
    itemIds: string[],
  ): Promise<{ playlist: PublishedPlaylistDetail; results: ImportCacheResponse[] }>;
}
