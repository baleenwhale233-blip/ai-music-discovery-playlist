import type { BilibiliFavoritePreviewResponse } from "@ai-music-playlist/api-contract";

type Input = {
  collection: {
    id: string;
    platformCollectionId: string;
    title: string | null;
  };
  items: Array<{
    id: string;
    position: number;
    isExcluded: boolean;
    sourceContent: {
      platformContentId: string;
      title: string;
      canonicalUrl: string;
      coverUrl: string | null;
      authorNameSnapshot: string | null;
      durationSec: number | null;
    };
  }>;
};

export function buildBilibiliFavoritePreviewResponse(input: Input): BilibiliFavoritePreviewResponse {
  return {
    collectionId: input.collection.id,
    mediaId: input.collection.platformCollectionId,
    title: input.collection.title,
    items: [...input.items]
      .filter((item) => !item.isExcluded)
      .sort((left, right) => left.position - right.position)
      .map((item) => ({
        id: item.id,
        bvid: item.sourceContent.platformContentId,
        title: item.sourceContent.title,
        url: item.sourceContent.canonicalUrl,
        coverUrl: item.sourceContent.coverUrl,
        ownerName: item.sourceContent.authorNameSnapshot,
        durationSeconds: item.sourceContent.durationSec,
        isExcluded: false
      }))
  };
}
