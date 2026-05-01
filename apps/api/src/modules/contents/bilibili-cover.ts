export function normalizeBilibiliCoverUrl(input?: string | null) {
  if (!input) {
    return null;
  }

  const source = input.trim().replace(/^\/\//, "https://").replace(/^http:\/\//i, "https://");

  try {
    const url = new URL(source);
    const hostname = url.hostname.toLowerCase();
    const isBilibiliImageHost =
      hostname === "hdslb.com" ||
      hostname.endsWith(".hdslb.com") ||
      hostname === "biliimg.com" ||
      hostname.endsWith(".biliimg.com");

    if (url.protocol !== "https:" || !isBilibiliImageHost) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function buildBilibiliCoverProxyPath(input?: string | null) {
  const sourceUrl = normalizeBilibiliCoverUrl(input);

  if (!sourceUrl) {
    return null;
  }

  return `/api/v1/contents/cover?url=${encodeURIComponent(sourceUrl)}`;
}
