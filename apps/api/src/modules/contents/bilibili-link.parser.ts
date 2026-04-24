const BV_PATTERN = /(BV[0-9A-Za-z]{10})/;
const FAVORITE_ID_PATTERNS = [
  /(?:fid|media_id|mlid)=([0-9]+)/,
  /\/lists\/([0-9]+)/,
  /\/list\/ml([0-9]+)/,
  /\/medialist\/detail\/ml([0-9]+)/,
  /\bml([0-9]{5,})\b/
];

function normalizePage(page: string | null): number {
  const parsed = Number(page ?? "1");

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return Math.floor(parsed);
}

export function parseBilibiliLink(rawInput: string) {
  const input = rawInput.trim();
  const bvidMatch = input.match(BV_PATTERN);

  if (!bvidMatch) {
    throw new Error("Unsupported bilibili link");
  }

  let page = 1;

  try {
    const url = new URL(input);
    page = normalizePage(url.searchParams.get("p"));
  } catch {
    page = 1;
  }

  const bvid = bvidMatch[1];

  if (!bvid) {
    throw new Error("Unsupported bilibili link");
  }

  return {
    bvid,
    page,
    normalizedUrl: `https://www.bilibili.com/video/${bvid}?p=${page}`
  };
}

export function isResolvableBilibiliShortLink(rawInput: string) {
  try {
    const url = new URL(rawInput.trim());
    return ["b23.tv", "bili2233.cn"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function parseBilibiliFavoriteLink(rawInput: string) {
  const input = rawInput.trim();
  const idMatch = FAVORITE_ID_PATTERNS.map((pattern) => input.match(pattern)).find(Boolean);

  if (!idMatch?.[1]) {
    throw new Error("Unsupported bilibili favorite link");
  }

  return {
    mediaId: idMatch[1]
  };
}

export function parseBilibiliCollectionLink(rawInput: string) {
  const input = rawInput.trim();

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
    // Copied snippets are handled by the regex fallback below.
  }

  const seasonMatch = input.match(/(?:sid|season_id)=(\d+)/i);
  const midMatch = input.match(/space\.bilibili\.com\/(\d+)\/channel\/collectiondetail/i);

  if (!seasonMatch?.[1]) {
    throw new Error("Unsupported bilibili collection link");
  }

  return {
    seasonId: seasonMatch[1],
    mid: midMatch?.[1] ?? null
  };
}
