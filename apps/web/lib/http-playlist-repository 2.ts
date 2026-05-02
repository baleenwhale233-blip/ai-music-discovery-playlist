import type { PlaylistRepository } from "./playlist-repository";

export function createHttpPlaylistRepository(): PlaylistRepository {
  const notEnabled = async () => {
    throw new Error("HTTP playlist repository is reserved for the future /api/v1 playlist draft endpoints.");
  };

  return {
    getActiveDraft: notEnabled,
    saveDraft: notEnabled,
    appendImportPreviewToDraft: notEnabled,
    removeDraftItems: notEnabled,
    moveDraftItem: notEnabled,
    reorderDraftItems: notEnabled,
    publishDraft: notEnabled,
    listPublishedPlaylists: notEnabled,
    getPublishedPlaylist: notEnabled,
    cachePublishedPlaylistItems: notEnabled
  };
}
