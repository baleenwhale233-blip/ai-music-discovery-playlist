import type {
  AuthVerifyCodeResponse,
  ImportCacheResponse,
  ImportPreviewResponse,
  LocalAudioPlaylistResponse
} from "@ai-music-playlist/api-contract";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000/api/v1";
const TOKEN_KEY = "ai_music_alpha_access_token";

function buildApiUrl(path: string) {
  if (path.startsWith("/api/v1")) {
    return `${API_BASE_URL.replace(/\/api\/v1\/?$/, "")}${path}`;
  }

  return `${API_BASE_URL}${path}`;
}

export function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {})
    }
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (isInvalidAlphaAuthResponse(response.status, payload)) {
      clearToken();
      throw new Error("登录已失效，请重新登录。");
    }

    throw new Error(payload.message ?? "请求失败");
  }

  return payload as T;
}

function isInvalidAlphaAuthResponse(status: number, payload: unknown) {
  if (status !== 401 || !payload || typeof payload !== "object" || !("message" in payload)) {
    return false;
  }

  const message = (payload as { message?: unknown }).message;

  return message === "Invalid bearer token" || message === "Missing bearer token";
}

export function buildMediaUrl(path: string | null) {
  if (!path) {
    return null;
  }

  const bilibiliCoverProxyPath = buildBilibiliCoverProxyPath(path);

  if (bilibiliCoverProxyPath) {
    return buildAuthenticatedApiUrl(bilibiliCoverProxyPath);
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return buildAuthenticatedApiUrl(path);
}

function buildAuthenticatedApiUrl(path: string) {
  const token = getStoredToken();
  const url = new URL(buildApiUrl(path));

  if (token) {
    // TODO: Replace long-lived alpha access_token media URLs with short-lived signed media URLs.
    url.searchParams.set("access_token", token);
  }

  return url.toString();
}

function buildBilibiliCoverProxyPath(path: string) {
  if (!/^https?:\/\//i.test(path) && !path.startsWith("//")) {
    return null;
  }

  const source = path.trim().replace(/^\/\//, "https://").replace(/^http:\/\//i, "https://");

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

    return `/api/v1/contents/cover?url=${encodeURIComponent(url.toString())}`;
  } catch {
    return null;
  }
}

export function login(input: { phoneOrEmail: string; code: string; inviteCode: string }) {
  return requestJson<AuthVerifyCodeResponse>("/auth/verify-code", {
    method: "POST",
    body: JSON.stringify({
      phoneOrEmail: input.phoneOrEmail,
      code: input.code,
      inviteCode: input.inviteCode,
      scenario: "login"
    })
  });
}

export function previewImport(input: { url: string; limit?: number }) {
  return requestJson<ImportPreviewResponse>("/imports/preview", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function cacheImportItems(input: { collectionId: string; itemIds: string[] }) {
  return requestJson<ImportCacheResponse>(`/imports/${encodeURIComponent(input.collectionId)}/cache`, {
    method: "POST",
    body: JSON.stringify({
      itemIds: input.itemIds
    })
  });
}

export function getLocalAudioPlaylist() {
  return requestJson<LocalAudioPlaylistResponse>("/playlists/local-audio");
}

export function deletePlaylistItem(playlistItemId: string) {
  return requestJson<{ id: string; deleted: boolean }>(
    `/playlists/local-audio/items/${encodeURIComponent(playlistItemId)}`,
    {
      method: "DELETE"
    },
  );
}

export function clearLocalAudioPlaylist() {
  return requestJson<{ deleted: boolean }>("/playlists/local-audio", {
    method: "DELETE"
  });
}
