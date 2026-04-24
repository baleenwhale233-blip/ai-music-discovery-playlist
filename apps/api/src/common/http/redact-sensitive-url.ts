const SENSITIVE_QUERY_PARAMS = new Set(["access_token"]);
const REDACTED_VALUE = "[redacted]";

export function redactSensitiveUrl(input: string | undefined) {
  if (!input) {
    return "";
  }

  const [path = "", hash = ""] = input.split("#", 2);
  const [basePath, query = ""] = path.split("?", 2);

  if (!query) {
    return input;
  }

  const params = new URLSearchParams();

  for (const [name, value] of new URLSearchParams(query)) {
    params.append(name, SENSITIVE_QUERY_PARAMS.has(name) ? REDACTED_VALUE : value);
  }

  const redactedQuery = params.toString();
  const redactedUrl = `${basePath}?${redactedQuery}`;

  return hash ? `${redactedUrl}#${hash}` : redactedUrl;
}
