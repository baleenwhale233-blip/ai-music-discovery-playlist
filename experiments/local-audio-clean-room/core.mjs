import { spawn, spawnSync } from "node:child_process";
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, extname, join, resolve, sep } from "node:path";

const AUDIO_EXTENSIONS = new Set([".m4a", ".mp3", ".aac", ".opus", ".webm"]);
const DEFAULT_PREVIEW_LIMIT = 500;
const MAX_PREVIEW_LIMIT = 1000;
const BILIBILI_FAVORITE_PAGE_SIZE = 20;

export const CLEAN_ROOM_CACHE_DIR = ".local-audio-clean-room-cache";
export const BILIBILI_DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
export const BILIBILI_MOBILE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

export function normalizeBilibiliCoverUrl(input) {
  if (!input) {
    return null;
  }

  if (input.startsWith("//")) {
    return `https:${input}`;
  }

  if (input.startsWith("http://")) {
    return input.replace("http://", "https://");
  }

  return input;
}

export function buildCoverProxyUrl(cacheKey, coverUrl) {
  return coverUrl ? `/api/cover/${encodeURIComponent(cacheKey)}` : null;
}

export function buildRemoteCoverProxyUrl(coverUrl) {
  const normalized = normalizeBilibiliCoverUrl(coverUrl);

  return normalized ? `/api/cover-proxy?url=${encodeURIComponent(normalized)}` : null;
}

export function parseBilibiliLink(rawInput) {
  const input = String(rawInput ?? "").trim();
  const bvid = input.match(/BV[0-9A-Za-z]{8,}/)?.[0];

  if (!bvid) {
    throw new Error("Unsupported bilibili video link");
  }

  let page = 1;

  try {
    const url = new URL(input);
    const pageFromUrl = Number(url.searchParams.get("p") ?? url.searchParams.get("page") ?? "1");
    page = Number.isFinite(pageFromUrl) && pageFromUrl > 0 ? Math.floor(pageFromUrl) : 1;
  } catch {
    page = 1;
  }

  return {
    bvid,
    page,
    normalizedUrl: `https://www.bilibili.com/video/${bvid}?p=${page}`
  };
}

export function parseBilibiliFavoriteLink(rawInput) {
  const input = String(rawInput ?? "").trim();

  try {
    const url = new URL(input);
    for (const key of ["fid", "media_id", "mlid"]) {
      const value = url.searchParams.get(key);
      if (value && /^\d+$/.test(value)) {
        return { mediaId: value };
      }
    }
  } catch {
    // Plain text URLs or copied snippets are handled by the regex patterns below.
  }

  const patterns = [
    /(?:fid|media_id|mlid)=(\d+)/i,
    /\/lists\/(\d+)/i,
    /\/medialist\/detail\/ml(\d+)/i,
    /\/list\/ml(\d+)/i,
    /\bml(\d{3,})\b/i
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) {
      return { mediaId: match[1] };
    }
  }

  throw new Error("Unsupported bilibili favorite link");
}

export function parseBilibiliCollectionLink(rawInput) {
  const input = String(rawInput ?? "").trim();

  try {
    const url = new URL(input);
    const seasonId = url.searchParams.get("sid") ?? url.searchParams.get("season_id");
    const mid = url.pathname.match(/\/(\d+)\/channel\/collectiondetail/i)?.[1];

    if (seasonId && /^\d+$/.test(seasonId)) {
      return {
        seasonId,
        mid: mid && /^\d+$/.test(mid) ? mid : null
      };
    }
  } catch {
    // Plain text URLs or copied snippets are handled by the regex patterns below.
  }

  const seasonMatch = input.match(/(?:sid|season_id)=(\d+)/i);
  const midMatch = input.match(/space\.bilibili\.com\/(\d+)\/channel\/collectiondetail/i);

  if (seasonMatch?.[1]) {
    return {
      seasonId: seasonMatch[1],
      mid: midMatch?.[1] ?? null
    };
  }

  throw new Error("Unsupported bilibili collection link");
}

export function extractAssignedJsonObject(input) {
  const start = input.html.indexOf(input.marker);

  if (start < 0) {
    throw new Error(`Missing marker: ${input.marker}`);
  }

  const firstBrace = input.html.indexOf("{", start + input.marker.length);

  if (firstBrace < 0) {
    throw new Error(`Unable to parse JSON for marker: ${input.marker}`);
  }

  let depth = 0;
  let end = -1;
  let inString = false;
  let escaped = false;

  for (let index = firstBrace; index < input.html.length; index += 1) {
    const char = input.html[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }

  if (end < 0) {
    throw new Error(`Unable to parse JSON for marker: ${input.marker}`);
  }

  return input.html.slice(firstBrace, end);
}

export function parseBilibiliMobileHtml5Playback(input) {
  const json = extractAssignedJsonObject({
    html: input.html,
    marker: "window.__INITIAL_STATE__"
  });
  const state = JSON.parse(json);
  const firstPlayable = state.video?.playUrlInfo?.find((item) => item?.url);

  if (!firstPlayable?.url) {
    throw new Error("Unable to resolve bilibili mobile play url");
  }

  return {
    playUrl: firstPlayable.url,
    cid: state.video?.viewInfo?.cid ?? null,
    title: state.video?.viewInfo?.title ?? null,
    coverUrl: normalizeBilibiliCoverUrl(state.video?.viewInfo?.pic)
  };
}

export function toSafeCacheKey(input) {
  const safe = String(input ?? "").replace(/[^0-9A-Za-z_-]/g, "");

  if (!safe) {
    throw new Error("Invalid cache key");
  }

  return safe;
}

export function getCachePaths(input) {
  const safeKey = toSafeCacheKey(input.cacheKey);
  const root = resolve(input.cacheRoot);
  const itemDir = resolve(root, safeKey);

  if (!itemDir.startsWith(`${root}${sep}`)) {
    throw new Error("Audio cache path escapes cache root");
  }

  return {
    root,
    itemDir,
    audioPath: join(itemDir, "audio.m4a"),
    metadataPath: join(itemDir, "metadata.json")
  };
}

export function ensureCacheDir(path) {
  mkdirSync(path, { recursive: true });
}

export function writeMetadata(input) {
  writeFileSync(input.metadataPath, JSON.stringify(input.metadata, null, 2), "utf8");
}

export function readMetadata(metadataPath) {
  if (!existsSync(metadataPath)) {
    return null;
  }

  return JSON.parse(readFileSync(metadataPath, "utf8"));
}

export function listCacheKeys(cacheRoot) {
  const root = resolve(cacheRoot);

  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root)
    .map((entry) => join(root, entry))
    .filter((entryPath) => statSync(entryPath).isDirectory())
    .map((entryPath) => basename(entryPath))
    .sort();
}

export function findCachedAudioFile(itemDir) {
  if (!existsSync(itemDir)) {
    return null;
  }

  return (
    readdirSync(itemDir)
      .map((fileName) => join(itemDir, fileName))
      .filter((filePath) => statSync(filePath).isFile() && AUDIO_EXTENSIONS.has(extname(filePath).toLowerCase()))
      .sort()[0] ?? null
  );
}

export function buildPlaylistFromCache(cacheRoot) {
  const items = listCacheKeys(cacheRoot)
    .map((cacheKey, index) => {
      const paths = getCachePaths({ cacheRoot, cacheKey });
      const audioFile = findCachedAudioFile(paths.itemDir);
      const metadata = readMetadata(paths.metadataPath);

      if (!audioFile) {
        return null;
      }

      return {
        id: cacheKey,
        sourceContentId: cacheKey,
        localAudioAssetId: null,
        position: index + 1,
        title: metadata?.title ?? cacheKey,
        coverUrl: buildCoverProxyUrl(cacheKey, metadata?.coverUrl),
        durationSeconds: metadata?.durationSeconds ?? null,
        audioUrl: `/api/audio/${cacheKey}`,
        cacheKey,
        status: "ready"
      };
    })
    .filter(Boolean);

  return {
    playlist: {
      id: "clean-room-local-cache",
      name: "Clean Room Local Playlist",
      kind: "music",
      sourceType: "manual",
      itemCount: items.length,
      cachedItemCount: items.length
    },
    items
  };
}

function resolvePreviewLimit(limit) {
  const parsed = Number(limit ?? DEFAULT_PREVIEW_LIMIT);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PREVIEW_LIMIT;
  }

  return Math.min(Math.floor(parsed), MAX_PREVIEW_LIMIT);
}

export function parseHttpRange(rangeHeader, totalSize) {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=") || totalSize <= 0) {
    return null;
  }

  const [startRaw, endRaw] = rangeHeader.replace("bytes=", "").split("-");
  const start = Number(startRaw);

  if (!Number.isFinite(start) || start < 0 || start >= totalSize) {
    return null;
  }

  const requestedEnd = endRaw ? Number(endRaw) : totalSize - 1;
  const end = Math.min(Number.isFinite(requestedEnd) ? requestedEnd : totalSize - 1, totalSize - 1);

  if (end < start) {
    return null;
  }

  return {
    start,
    end,
    chunkSize: end - start + 1,
    totalSize,
    contentRange: `bytes ${start}-${end}/${totalSize}`
  };
}

export function buildFfmpegAudioExtractArgs(input) {
  return [
    "-y",
    "-headers",
    `Referer: https://m.bilibili.com/\r\nUser-Agent: ${BILIBILI_MOBILE_USER_AGENT}\r\n`,
    "-i",
    input.sourceUrl,
    "-vn",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    input.outputAudioPath
  ];
}

export function assertExecutableAvailable(command) {
  for (const candidate of [`/opt/homebrew/bin/${command}`, `/usr/local/bin/${command}`]) {
    try {
      accessSync(candidate, constants.X_OK);
      return;
    } catch {
      // Keep checking common Homebrew locations and then PATH.
    }
  }

  const check = spawnSync(command, ["--version"], { stdio: "ignore" });

  if (check.status !== 0) {
    throw new Error(`${command} is required. Install it with: brew install ffmpeg`);
  }
}

export function runFfmpeg(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stderr = [];

    child.stderr.on("data", (chunk) => {
      stderr.push(chunk.toString("utf8"));
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(stderr.join("").trim() || `ffmpeg exited with ${code}`));
    });
  });
}

export async function fetchBilibiliVideoMeta(input) {
  const response = await input.fetchImpl(`https://api.bilibili.com/x/web-interface/view?bvid=${input.bvid}`, {
    headers: {
      "user-agent": BILIBILI_DESKTOP_USER_AGENT,
      referer: `https://www.bilibili.com/video/${input.bvid}`
    }
  });

  if (!response.ok) {
    throw new Error(`Bilibili meta request failed with ${response.status}`);
  }

  const payload = await response.json();

  if (payload.code !== 0 || !payload.data) {
    throw new Error(payload.message || "Unable to load bilibili video info");
  }

  const pageData = payload.data.pages?.[input.page - 1] ?? payload.data.pages?.[0];

  return {
    cid: pageData?.cid ?? null,
    title: payload.data.title ?? input.bvid,
    coverUrl: normalizeBilibiliCoverUrl(payload.data.pic),
    ownerName: payload.data.owner?.name ?? null,
    durationSeconds: pageData?.duration ?? payload.data.duration ?? null
  };
}

export async function fetchBilibiliMobilePlayableUrl(input) {
  const response = await input.fetchImpl(`https://m.bilibili.com/video/${input.bvid}?p=${input.page}`, {
    headers: {
      "user-agent": BILIBILI_MOBILE_USER_AGENT,
      referer: "https://m.bilibili.com/"
    }
  });

  if (!response.ok) {
    throw new Error(`Bilibili mobile page request failed with ${response.status}`);
  }

  return parseBilibiliMobileHtml5Playback({ html: await response.text() }).playUrl;
}

function mapBilibiliCollectionEpisode(input) {
  const bvid = input.episode?.bvid ?? input.episode?.arc?.bvid;

  if (!bvid) {
    return null;
  }

  return {
    id: `${input.seasonId}-${bvid}-${input.index + 1}`,
    bvid,
    title: input.episode?.title ?? input.episode?.arc?.title ?? bvid,
    url: `https://www.bilibili.com/video/${bvid}`,
    coverUrl: buildRemoteCoverProxyUrl(input.episode?.arc?.pic ?? input.episode?.cover ?? input.episode?.pic),
    ownerName: input.episode?.arc?.author?.name ?? input.ownerName ?? null,
    durationSeconds: input.episode?.arc?.duration ?? input.episode?.page?.duration ?? null,
    isExcluded: false
  };
}

function mapBilibiliCollectionArchive(input) {
  const bvid = input.archive?.bvid;

  if (!bvid) {
    return null;
  }

  return {
    id: `${input.seasonId}-${bvid}-${input.index + 1}`,
    bvid,
    title: input.archive?.title ?? bvid,
    url: `https://www.bilibili.com/video/${bvid}`,
    coverUrl: buildRemoteCoverProxyUrl(input.archive?.pic),
    ownerName: input.ownerName ?? null,
    durationSeconds: input.archive?.duration ?? null,
    isExcluded: false
  };
}

export function parseBilibiliVideoCollectionPreview(input) {
  const json = extractAssignedJsonObject({
    html: input.html,
    marker: "window.__INITIAL_STATE__"
  });
  const state = JSON.parse(json);
  const season = state.videoData?.ugc_season;

  if (!season?.id) {
    throw new Error("Unable to find bilibili video collection info");
  }

  const limit = resolvePreviewLimit(input.limit);
  const episodes = (season.sections ?? []).flatMap((section) => section?.episodes ?? []).slice(0, limit);
  const ownerName = state.videoData?.owner?.name ?? null;
  const items = episodes
    .map((episode, index) =>
      mapBilibiliCollectionEpisode({
        episode,
        index,
        seasonId: String(season.id),
        ownerName
      }),
    )
    .filter(Boolean);

  return {
    collectionId: `bilibili-season-${season.id}`,
    mediaId: String(season.id),
    title: season.title ?? null,
    mid: season.mid ? String(season.mid) : null,
    totalCount: season.ep_count ?? items.length,
    items
  };
}

async function fetchBilibiliDesktopVideoCollectionPreview(input) {
  const parsed = parseBilibiliLink(input.url);
  const response = await input.fetchImpl(`https://www.bilibili.com/video/${parsed.bvid}/`, {
    headers: {
      "user-agent": BILIBILI_DESKTOP_USER_AGENT,
      referer: "https://www.bilibili.com/"
    }
  });

  if (!response.ok) {
    throw new Error(`Bilibili video collection page request failed with ${response.status}`);
  }

  const preview = parseBilibiliVideoCollectionPreview({
    html: await response.text(),
    limit: input.limit
  });

  if (preview.mid && preview.items.length < Math.min(preview.totalCount ?? preview.items.length, resolvePreviewLimit(input.limit))) {
    try {
      return await fetchBilibiliSeasonArchivesPreview({
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

export async function fetchBilibiliSeasonArchivesPreview(input) {
  const limit = resolvePreviewLimit(input.limit);
  const pageSize = Math.min(limit, 50);
  let pageNum = 1;
  let total = null;
  let title = null;
  let ownerName = null;
  const items = [];

  while (items.length < limit && (total === null || items.length < total)) {
    const query = new URLSearchParams({
      mid: String(input.mid),
      season_id: String(input.seasonId),
      page_num: String(pageNum),
      page_size: String(pageSize)
    });
    const response = await input.fetchImpl(`https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?${query.toString()}`, {
      headers: {
        "user-agent": BILIBILI_DESKTOP_USER_AGENT,
        referer: `https://space.bilibili.com/${input.mid}/channel/collectiondetail?sid=${input.seasonId}`
      }
    });

    if (!response.ok) {
      throw new Error(`Bilibili collection request failed with ${response.status}`);
    }

    const payload = await response.json();

    if (payload.code !== 0 || !payload.data) {
      throw new Error(payload.message || "Unable to load bilibili collection list");
    }

    total = payload.data.page?.total ?? payload.data.meta?.total ?? total;
    title = payload.data.meta?.title ?? title;
    ownerName = payload.data.meta?.name ?? ownerName;

    const archives = payload.data.archives ?? [];
    const mapped = archives
      .map((archive, index) =>
        mapBilibiliCollectionArchive({
          archive,
          index: items.length + index,
          seasonId: String(input.seasonId),
          ownerName
        }),
      )
      .filter(Boolean);

    items.push(...mapped);

    if (archives.length === 0 || archives.length < pageSize) {
      break;
    }

    pageNum += 1;
  }

  return {
    collectionId: `bilibili-season-${input.seasonId}`,
    mediaId: String(input.seasonId),
    title,
    mid: String(input.mid),
    totalCount: total ?? items.length,
    items: items.slice(0, limit)
  };
}

export async function fetchBilibiliFavoritePreview(input) {
  let parsed;

  try {
    parsed = parseBilibiliFavoriteLink(input.url);
  } catch {
    try {
      const collection = parseBilibiliCollectionLink(input.url);

      if (collection.mid) {
        return fetchBilibiliSeasonArchivesPreview({
          seasonId: collection.seasonId,
          mid: collection.mid,
          limit: input.limit,
          fetchImpl: input.fetchImpl
        });
      }
    } catch {
      // Fall back to video-page collections, such as links copied from a custom collection.
    }

    return fetchBilibiliDesktopVideoCollectionPreview(input);
  }

  const limit = resolvePreviewLimit(input.limit);
  const medias = [];
  let page = 1;
  let title = null;
  let totalCount = null;

  while (medias.length < limit) {
    const query = new URLSearchParams({
      media_id: parsed.mediaId,
      pn: String(page),
      ps: String(BILIBILI_FAVORITE_PAGE_SIZE)
    });
    const response = await input.fetchImpl(`https://api.bilibili.com/x/v3/fav/resource/list?${query.toString()}`, {
      headers: {
        "user-agent": BILIBILI_DESKTOP_USER_AGENT,
        referer: "https://www.bilibili.com/"
      }
    });

    if (!response.ok) {
      throw new Error(`Bilibili favorite request failed with ${response.status}`);
    }

    const payload = await response.json();

    if (payload.code !== 0 || !payload.data) {
      throw new Error(payload.message || "Unable to load bilibili favorite list");
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

  return {
    collectionId: `bilibili-${parsed.mediaId}`,
    mediaId: parsed.mediaId,
    title,
    totalCount: totalCount ?? medias.length,
    items: medias
      .filter((item) => item?.bvid)
      .slice(0, limit)
      .map((item, index) => ({
        id: `${parsed.mediaId}-${item.bvid}-${index + 1}`,
        bvid: item.bvid,
        title: item.title ?? item.bvid,
        url: `https://www.bilibili.com/video/${item.bvid}`,
        coverUrl: buildRemoteCoverProxyUrl(item.cover),
        ownerName: item.upper?.name ?? null,
        durationSeconds: item.duration ?? null,
        isExcluded: false
      }))
  };
}

export async function cacheBilibiliAudio(input) {
  assertExecutableAvailable("ffmpeg");

  const parsed = parseBilibiliLink(input.url);
  const cacheKey = toSafeCacheKey(parsed.bvid);
  const paths = getCachePaths({ cacheRoot: input.cacheRoot, cacheKey });
  ensureCacheDir(paths.itemDir);

  const meta = await fetchBilibiliVideoMeta({
    bvid: parsed.bvid,
    page: parsed.page,
    fetchImpl: input.fetchImpl
  });

  let audioFile = findCachedAudioFile(paths.itemDir);
  let cached = true;

  if (!audioFile) {
    cached = false;
    const playUrl = await fetchBilibiliMobilePlayableUrl({
      bvid: parsed.bvid,
      page: parsed.page,
      fetchImpl: input.fetchImpl
    });
    await runFfmpeg(buildFfmpegAudioExtractArgs({ sourceUrl: playUrl, outputAudioPath: paths.audioPath }));
    audioFile = findCachedAudioFile(paths.itemDir);
  }

  if (!audioFile) {
    throw new Error("ffmpeg finished but no local audio file was found");
  }

  writeMetadata({
    metadataPath: paths.metadataPath,
    metadata: {
      cacheKey,
      sourceUrl: input.url,
      normalizedUrl: parsed.normalizedUrl,
      title: meta.title,
      bvid: parsed.bvid,
      coverUrl: meta.coverUrl,
      durationSeconds: meta.durationSeconds,
      createdAt: new Date().toISOString()
    }
  });

  return {
    cacheKey,
    sourceUrl: input.url,
    normalizedUrl: parsed.normalizedUrl,
    title: meta.title,
    bvid: parsed.bvid,
    audioUrl: `/api/audio/${cacheKey}`,
    coverUrl: buildCoverProxyUrl(cacheKey, meta.coverUrl),
    durationSeconds: meta.durationSeconds,
    cached,
    message: cached ? "Found existing local audio cache." : "Generated local audio cache."
  };
}

export function deleteCacheItem(input) {
  const paths = getCachePaths({ cacheRoot: input.cacheRoot, cacheKey: input.cacheKey });

  rmSync(paths.itemDir, { recursive: true, force: true });

  return {
    cacheKey: toSafeCacheKey(input.cacheKey),
    deleted: true
  };
}

export function clearCache(cacheRoot) {
  rmSync(resolve(cacheRoot), { recursive: true, force: true });

  return {
    deleted: true
  };
}
