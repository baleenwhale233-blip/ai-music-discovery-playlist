import type { LocalAudioPlaylistResponse } from "@ai-music-playlist/api-contract";

import { buildBilibiliCoverProxyPath } from "./bilibili-cover";

type PlaylistModel = {
  id: string;
  name: string;
  kind: string;
  sourceType: string;
};

type PlaylistItemModel = {
  id: string;
  sourceContentId: string;
  localAudioAssetId: string | null;
  position: number;
  titleSnapshot: string | null;
  coverUrlSnapshot: string | null;
  durationSecSnapshot: number | null;
  sourceContent: {
    title: string;
    coverUrl: string | null;
    durationSec: number | null;
  };
  localAudioAsset: {
    id: string;
    cacheKey: string;
    status: string;
    storageType?: string;
  } | null;
};

function normalizeEnum(value: string) {
  return value.toLowerCase() as "music" | "learning" | "mixed";
}

function normalizeSourceType(value: string) {
  return value.toLowerCase() as "manual" | "imported_collection" | "editorial";
}

type LocalAudioStatus = "pending" | "caching" | "ready" | "failed" | "deleted" | null;

function normalizeStatus(status: string | null | undefined): LocalAudioStatus {
  switch (status) {
    case "PENDING":
      return "pending";
    case "CACHING":
      return "caching";
    case "READY":
      return "ready";
    case "FAILED":
      return "failed";
    case "DELETED":
      return "deleted";
    default:
      return null;
  }
}

function buildPlaylistCoverUrl(item: PlaylistItemModel) {
  const sourceCoverUrl = item.coverUrlSnapshot ?? item.sourceContent.coverUrl;

  return buildBilibiliCoverProxyPath(sourceCoverUrl) ?? sourceCoverUrl;
}

export function buildLocalAudioPlaylistResponse(input: {
  playlist: PlaylistModel;
  items: PlaylistItemModel[];
}): LocalAudioPlaylistResponse {
  const items = input.items
    .slice()
    .sort((left, right) => left.position - right.position)
    .map((item) => {
      const cacheKey = item.localAudioAsset?.cacheKey ?? null;
      const status = normalizeStatus(item.localAudioAsset?.status);
      const hasServerArtifact = status === "ready" && item.localAudioAsset?.storageType !== "USER_DEVICE";

      return {
        id: item.id,
        sourceContentId: item.sourceContentId,
        localAudioAssetId: item.localAudioAssetId,
        position: item.position,
        title: item.titleSnapshot ?? item.sourceContent.title,
        coverUrl: buildPlaylistCoverUrl(item),
        durationSeconds: item.durationSecSnapshot ?? item.sourceContent.durationSec,
        audioUrl: item.localAudioAsset?.id && hasServerArtifact
          ? `/api/v1/local-audio/assets/${encodeURIComponent(item.localAudioAsset.id)}/download`
          : null,
        cacheKey,
        status
      };
    });

  return {
    playlist: {
      id: input.playlist.id,
      name: input.playlist.name,
      kind: normalizeEnum(input.playlist.kind),
      sourceType: normalizeSourceType(input.playlist.sourceType),
      itemCount: items.length,
      cachedItemCount: items.filter((item) => item.status === "ready").length
    },
    items
  };
}
