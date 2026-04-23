import type { ExperimentalPlaylistResponse } from "@ai-music-playlist/api-contract";

type Input = {
  playlist: {
    id: string;
    name: string;
    kind: "MUSIC" | "LEARNING" | "MIXED";
    sourceType: "MANUAL" | "IMPORTED_COLLECTION" | "EDITORIAL";
  };
  items: Array<{
    id: string;
    position: number;
    sourceContentId: string;
    localAudioAssetId: string | null;
    titleSnapshot: string | null;
    coverUrlSnapshot: string | null;
    durationSecSnapshot: number | null;
    sourceContent: {
      title: string;
      coverUrl: string | null;
      durationSec: number | null;
    };
    localAudioAsset: {
      cacheKey: string;
      status: "PENDING" | "CACHING" | "READY" | "FAILED" | "DELETED";
    } | null;
  }>;
};

export function buildExperimentalPlaylistResponse(input: Input): ExperimentalPlaylistResponse {
  const items = [...input.items]
    .sort((left, right) => left.position - right.position)
    .map((item) => ({
      id: item.id,
      sourceContentId: item.sourceContentId,
      localAudioAssetId: item.localAudioAssetId,
      position: item.position,
      title: item.titleSnapshot ?? item.sourceContent.title,
      coverUrl: item.coverUrlSnapshot ?? item.sourceContent.coverUrl,
      durationSeconds: item.durationSecSnapshot ?? item.sourceContent.durationSec,
      audioUrl: item.localAudioAsset ? `/api/v1/contents/experimental/local-audio/${item.localAudioAsset.cacheKey}/audio` : null,
      cacheKey: item.localAudioAsset?.cacheKey ?? null,
      status: item.localAudioAsset?.status.toLowerCase() as
        | "pending"
        | "caching"
        | "ready"
        | "failed"
        | "deleted"
        | null
    }));

  return {
    playlist: {
      id: input.playlist.id,
      name: input.playlist.name,
      kind: input.playlist.kind.toLowerCase() as "music" | "learning" | "mixed",
      sourceType: input.playlist.sourceType.toLowerCase() as "manual" | "imported_collection" | "editorial",
      itemCount: items.length,
      cachedItemCount: items.filter((item) => item.status === "ready").length
    },
    items
  };
}
