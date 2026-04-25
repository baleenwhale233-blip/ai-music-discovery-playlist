export function normalizeBilibiliCoverUrl(input?: string | null) {
  if (!input) {
    return null;
  }

  return input.replace(/^\/\//, "https://").replace(/^http:\/\//i, "https://");
}
