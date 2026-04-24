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
    throw new Error(payload.message ?? "请求失败");
  }

  return payload as T;
}

export function buildMediaUrl(path: string | null) {
  if (!path) {
    return null;
  }

  const token = getStoredToken();
  const url = new URL(buildApiUrl(path));

  if (token) {
    url.searchParams.set("access_token", token);
  }

  return url.toString();
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
