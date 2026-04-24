import { BadRequestException } from "@nestjs/common";

import { normalizeBilibiliCoverUrl } from "./bilibili-cover";
import {
  parseBilibiliCollectionLink,
  parseBilibiliFavoriteLink,
  parseBilibiliLink
} from "./bilibili-link.parser";
import { BILIBILI_DESKTOP_USER_AGENT, extractAssignedJsonObject } from "./local-audio-cache";

const DEFAULT_PREVIEW_LIMIT = 500;
const MAX_PREVIEW_LIMIT = 1000;
const BILIBILI_FAVORITE_PAGE_SIZE = 20;

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

type ImportPreviewItem = {
  id: string;
  bvid: string;
  title: string;
  url: string;
  coverUrl: string | null;
  ownerName: string | null;
  durationSeconds: number | null;
  isExcluded: boolean;
};

function resolvePreviewLimit(limit: number | undefined) {
  if (!Number.isFinite(limit) || !limit || limit <= 0) {
    return DEFAULT_PREVIEW_LIMIT;
  }

  return Math.min(Math.floor(limit), MAX_PREVIEW_LIMIT);
}

export function buildRemoteBilibiliCoverUrl(coverUrl: string | null | undefined) {
  const normalized = normalizeBilibiliCoverUrl(coverUrl ?? null);

  return normalized ? `/api/v1/contents/debug/cover?url=${encodeURIComponent(normalized)}` : null;
}

function mapFavoriteItem(input: {
  mediaId: string;
  item: {
    bvid?: string;
    title?: string;
    cover?: string;
    duration?: number;
    upper?: {
      name?: string;
    };
  };
  index: number;
}): ImportPreviewItem | null {
  if (!input.item.bvid) {
    return null;
  }

  return {
    id: `${input.mediaId}-${input.item.bvid}-${input.index + 1}`,
    bvid: input.item.bvid,
    title: input.item.title ?? input.item.bvid,
    url: `https://www.bilibili.com/video/${input.item.bvid}`,
    coverUrl: buildRemoteBilibiliCoverUrl(input.item.cover),
    ownerName: input.item.upper?.name ?? null,
    durationSeconds: input.item.duration ?? null,
    isExcluded: false
  };
}

function mapCollectionArchive(input: {
  seasonId: string;
  archive: {
    bvid?: string;
    title?: string;
    pic?: string;
    duration?: number;
  };
  ownerName: string | null;
  index: number;
}): ImportPreviewItem | null {
  if (!input.archive.bvid) {
    return null;
  }

  return {
    id: `${input.seasonId}-${input.archive.bvid}-${input.index + 1}`,
    bvid: input.archive.bvid,
    title: input.archive.title ?? input.archive.bvid,
    url: `https://www.bilibili.com/video/${input.archive.bvid}`,
    coverUrl: buildRemoteBilibiliCoverUrl(input.archive.pic),
    ownerName: input.ownerName,
    durationSeconds: input.archive.duration ?? null,
    isExcluded: false
  };
}

function mapVideoCollectionEpisode(input: {
  seasonId: string;
  episode: {
    bvid?: string;
    title?: string;
    cover?: string;
    pic?: string;
    arc?: {
      bvid?: string;
      title?: string;
      pic?: string;
      duration?: number;
      author?: {
        name?: string;
      };
    };
    page?: {
      duration?: number;
    };
  };
  ownerName: string | null;
  index: number;
}): ImportPreviewItem | null {
  const bvid = input.episode.bvid ?? input.episode.arc?.bvid;

  if (!bvid) {
    return null;
  }

  return {
    id: `${input.seasonId}-${bvid}-${input.index + 1}`,
    bvid,
    title: input.episode.title ?? input.episode.arc?.title ?? bvid,
    url: `https://www.bilibili.com/video/${bvid}`,
    coverUrl: buildRemoteBilibiliCoverUrl(
      input.episode.arc?.pic ?? input.episode.cover ?? input.episode.pic,
    ),
    ownerName: input.episode.arc?.author?.name ?? input.ownerName,
    durationSeconds: input.episode.arc?.duration ?? input.episode.page?.duration ?? null,
    isExcluded: false
  };
}

export async function fetchBilibiliFavoriteImportPreview(input: {
  url: string;
  mediaId: string;
  limit?: number;
  fetchImpl: FetchImpl;
}) {
  const limit = resolvePreviewLimit(input.limit);
  const medias: Array<Parameters<typeof mapFavoriteItem>[0]["item"]> = [];
  let page = 1;
  let title: string | null = null;
  let totalCount: number | null = null;

  while (medias.length < limit) {
    const query = new URLSearchParams({
      media_id: input.mediaId,
      pn: String(page),
      ps: String(BILIBILI_FAVORITE_PAGE_SIZE)
    });
    const response = await input.fetchImpl(
      `https://api.bilibili.com/x/v3/fav/resource/list?${query.toString()}`,
      {
        headers: {
          "user-agent": BILIBILI_DESKTOP_USER_AGENT,
          referer: "https://www.bilibili.com/"
        }
      },
    );

    if (!response.ok) {
      throw new BadRequestException(`Bilibili favorite request failed with ${response.status}`);
    }

    const payload = await response.json() as {
      code: number;
      message?: string;
      data?: {
        info?: {
          title?: string;
          media_count?: number;
        };
        has_more?: boolean;
        medias?: Array<Parameters<typeof mapFavoriteItem>[0]["item"]>;
      };
    };

    if (payload.code !== 0 || !payload.data) {
      throw new BadRequestException(payload.message || "Unable to load bilibili favorite list");
    }

    title = payload.data.info?.title ?? title;
    totalCount = payload.data.info?.media_count ?? totalCount;

    const pageMedias = payload.data.medias ?? [];
    medias.push(...pageMedias);

    if (!payload.data.has_more || pageMedias.length === 0) {
      break;
    }

    page += 1;
  }

  const items = medias
    .slice(0, limit)
    .map((item, index) => mapFavoriteItem({ mediaId: input.mediaId, item, index }))
    .filter((item): item is ImportPreviewItem => Boolean(item));

  return {
    collectionId: `bilibili-${input.mediaId}`,
    mediaId: input.mediaId,
    title,
    sourceType: "playlist" as const,
    totalCount: totalCount ?? items.length,
    items
  };
}

export function parseBilibiliVideoCollectionPreview(input: { html: string; limit?: number }) {
  const json = extractAssignedJsonObject({
    html: input.html,
    marker: "window.__INITIAL_STATE__"
  });
  const state = JSON.parse(json) as {
    videoData?: {
      owner?: {
        name?: string;
      };
      ugc_season?: {
        id?: number | string;
        mid?: number | string;
        title?: string;
        ep_count?: number;
        sections?: Array<{
          episodes?: Array<Parameters<typeof mapVideoCollectionEpisode>[0]["episode"]>;
        }>;
      };
    };
  };
  const season = state.videoData?.ugc_season;

  if (!season?.id) {
    throw new BadRequestException("Unable to find bilibili video collection info");
  }

  const limit = resolvePreviewLimit(input.limit);
  const ownerName = state.videoData?.owner?.name ?? null;
  const seasonId = String(season.id);
  const episodes = (season.sections ?? []).flatMap((section) => section.episodes ?? []).slice(0, limit);
  const items = episodes
    .map((episode, index) =>
      mapVideoCollectionEpisode({
        seasonId,
        episode,
        ownerName,
        index
      }),
    )
    .filter((item): item is ImportPreviewItem => Boolean(item));

  return {
    collectionId: `bilibili-season-${seasonId}`,
    mediaId: seasonId,
    title: season.title ?? null,
    sourceType: "collection" as const,
    mid: season.mid ? String(season.mid) : null,
    totalCount: season.ep_count ?? items.length,
    items
  };
}

export async function fetchBilibiliSeasonArchivesImportPreview(input: {
  seasonId: string;
  mid: string;
  limit?: number;
  fetchImpl: FetchImpl;
}) {
  const limit = resolvePreviewLimit(input.limit);
  const pageSize = Math.min(limit, 50);
  const items: ImportPreviewItem[] = [];
  let pageNum = 1;
  let totalCount: number | null = null;
  let title: string | null = null;
  let ownerName: string | null = null;

  while (items.length < limit && (totalCount === null || items.length < totalCount)) {
    const query = new URLSearchParams({
      mid: input.mid,
      season_id: input.seasonId,
      page_num: String(pageNum),
      page_size: String(pageSize)
    });
    const response = await input.fetchImpl(
      `https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?${query.toString()}`,
      {
        headers: {
          "user-agent": BILIBILI_DESKTOP_USER_AGENT,
          referer: `https://space.bilibili.com/${input.mid}/channel/collectiondetail?sid=${input.seasonId}`
        }
      },
    );

    if (!response.ok) {
      throw new BadRequestException(`Bilibili collection request failed with ${response.status}`);
    }

    const payload = await response.json() as {
      code: number;
      message?: string;
      data?: {
        page?: {
          total?: number;
        };
        meta?: {
          total?: number;
          title?: string;
          name?: string;
        };
        archives?: Array<Parameters<typeof mapCollectionArchive>[0]["archive"]>;
      };
    };

    if (payload.code !== 0 || !payload.data) {
      throw new BadRequestException(payload.message || "Unable to load bilibili collection list");
    }

    totalCount = payload.data.page?.total ?? payload.data.meta?.total ?? totalCount;
    title = payload.data.meta?.title ?? title;
    ownerName = payload.data.meta?.name ?? ownerName;

    const archives = payload.data.archives ?? [];
    const mapped = archives
      .map((archive, index) =>
        mapCollectionArchive({
          seasonId: input.seasonId,
          archive,
          ownerName,
          index: items.length + index
        }),
      )
      .filter((item): item is ImportPreviewItem => Boolean(item));

    items.push(...mapped);

    if (archives.length === 0 || archives.length < pageSize) {
      break;
    }

    pageNum += 1;
  }

  return {
    collectionId: `bilibili-season-${input.seasonId}`,
    mediaId: input.seasonId,
    title,
    sourceType: "collection" as const,
    totalCount: totalCount ?? items.length,
    items: items.slice(0, limit)
  };
}

async function fetchBilibiliDesktopVideoCollectionImportPreview(input: {
  url: string;
  limit?: number;
  fetchImpl: FetchImpl;
}) {
  const parsed = parseBilibiliLink(input.url);
  const response = await input.fetchImpl(`https://www.bilibili.com/video/${parsed.bvid}/`, {
    headers: {
      "user-agent": BILIBILI_DESKTOP_USER_AGENT,
      referer: "https://www.bilibili.com/"
    }
  });

  if (!response.ok) {
    throw new BadRequestException(`Bilibili video collection page request failed with ${response.status}`);
  }

  const preview = parseBilibiliVideoCollectionPreview({
    html: await response.text(),
    limit: input.limit
  });
  const limit = resolvePreviewLimit(input.limit);

  if (preview.mid && preview.items.length < Math.min(preview.totalCount, limit)) {
    try {
      return await fetchBilibiliSeasonArchivesImportPreview({
        seasonId: preview.mediaId,
        mid: preview.mid,
        limit: input.limit,
        fetchImpl: input.fetchImpl
      });
    } catch {
      return preview;
    }
  }

  return preview;
}

export async function fetchBilibiliSingleVideoImportPreview(input: {
  url: string;
  fetchImpl: FetchImpl;
}) {
  const parsed = parseBilibiliLink(input.url);
  const response = await input.fetchImpl(`https://api.bilibili.com/x/web-interface/view?bvid=${parsed.bvid}`, {
    headers: {
      "user-agent": BILIBILI_DESKTOP_USER_AGENT,
      referer: `https://www.bilibili.com/video/${parsed.bvid}`
    }
  });

  if (!response.ok) {
    throw new BadRequestException(`Bilibili meta request failed with ${response.status}`);
  }

  const payload = await response.json() as {
    code: number;
    message?: string;
    data?: {
      title?: string;
      pic?: string;
      duration?: number;
      owner?: {
        name?: string;
      };
      pages?: Array<{
        duration?: number;
      }>;
    };
  };

  if (payload.code !== 0 || !payload.data) {
    throw new BadRequestException(payload.message || "Unable to load bilibili video info");
  }

  const pageData = payload.data.pages?.[parsed.page - 1] ?? payload.data.pages?.[0];
  const item = {
    id: `single-${parsed.bvid}`,
    bvid: parsed.bvid,
    title: payload.data.title ?? parsed.bvid,
    url: parsed.normalizedUrl,
    coverUrl: buildRemoteBilibiliCoverUrl(payload.data.pic),
    ownerName: payload.data.owner?.name ?? null,
    durationSeconds: pageData?.duration ?? payload.data.duration ?? null,
    isExcluded: false
  };

  return {
    collectionId: `bilibili-single-${parsed.bvid}`,
    mediaId: parsed.bvid,
    title: item.title,
    sourceType: "single" as const,
    totalCount: 1,
    items: [item]
  };
}

export async function fetchBilibiliImportPreview(input: {
  url: string;
  limit?: number;
  fetchImpl: FetchImpl;
}) {
  try {
    const parsed = parseBilibiliFavoriteLink(input.url);

    return fetchBilibiliFavoriteImportPreview({
      url: input.url,
      mediaId: parsed.mediaId,
      limit: input.limit,
      fetchImpl: input.fetchImpl
    });
  } catch {
    // Not a medialist/favorite link. Continue with other public Bilibili collection shapes.
  }

  try {
    const collection = parseBilibiliCollectionLink(input.url);

    if (collection.mid) {
      return fetchBilibiliSeasonArchivesImportPreview({
        seasonId: collection.seasonId,
        mid: collection.mid,
        limit: input.limit,
        fetchImpl: input.fetchImpl
      });
    }
  } catch {
    // Fall through to video page collection parsing.
  }

  const shouldTryVideoCollection = /custom_collection|collectiondetail|season_id|sid=/i.test(input.url);

  if (!shouldTryVideoCollection) {
    return fetchBilibiliSingleVideoImportPreview(input);
  }

  try {
    return await fetchBilibiliDesktopVideoCollectionImportPreview(input);
  } catch {
    return fetchBilibiliSingleVideoImportPreview(input);
  }
}
