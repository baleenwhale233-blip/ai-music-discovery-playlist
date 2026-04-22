export function normalizeBilibiliCoverUrl(input?: string | null) {
  if (!input) {
    return null;
  }

  return input.replace(/^http:\/\//i, "https://");
}
