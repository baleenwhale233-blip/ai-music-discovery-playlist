import { afterEach, describe, expect, it, vi } from "vitest";

import { buildMediaUrl, getStoredToken, previewImport, storeToken } from "./api";

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();

  get length() {
    return this.data.size;
  }

  clear() {
    this.data.clear();
  }

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildMediaUrl", () => {
  it("routes bilibili image hosts through the formal cover proxy", () => {
    expect(buildMediaUrl("https://i0.hdslb.com/bfs/archive/cover.jpg")).toBe(
      "http://127.0.0.1:4000/api/v1/contents/cover?url=https%3A%2F%2Fi0.hdslb.com%2Fbfs%2Farchive%2Fcover.jpg",
    );
  });

  it("leaves non-bilibili external media URLs untouched", () => {
    expect(buildMediaUrl("https://example.com/media.mp3")).toBe("https://example.com/media.mp3");
  });

  it("clears a stale alpha token when the API rejects bearer auth", async () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ message: "Invalid bearer token" }),
      {
        headers: { "content-type": "application/json" },
        status: 401
      },
    )));

    storeToken("stale-token");

    await expect(previewImport({ url: "https://www.bilibili.com/list/ml3960775205" })).rejects.toThrow(
      "登录已失效，请重新登录。",
    );
    expect(getStoredToken()).toBeNull();
  });
});
