import { describe, expect, it } from "vitest";

import {
  authRequestCodeSchema,
  experimentalPlaylistResponseSchema,
  authVerifyCodeResponseSchema,
  bilibiliFavoritePreviewResponseSchema,
  importPreviewResponseSchema,
  localAudioCacheRequestCreateResponseSchema,
  localAudioConfirmClientCacheRequestSchema,
  localAudioConfirmClientCacheResponseSchema,
  localAudioPlaylistResponseSchema,
  localAudioTaskStatusResponseSchema,
  modulePrefixes
} from "./index";

describe("api-contract package", () => {
  it("validates auth request payloads", () => {
    const parsed = authRequestCodeSchema.parse({
      phoneNumber: "13800000000",
      scenario: "login"
    });

    expect(parsed.phoneNumber).toBe("13800000000");
  });

  it("keeps the auth response contract", () => {
    const parsed = authVerifyCodeResponseSchema.parse({
      accessToken: "token",
      refreshToken: "refresh",
      expiresIn: 3600
    });

    expect(parsed.expiresIn).toBe(3600);
    expect(modulePrefixes.auth).toBe("auth");
  });

  it("keeps the experimental playlist response contract", () => {
    const parsed = experimentalPlaylistResponseSchema.parse({
      playlist: {
        id: "playlist-1",
        name: "实验本地听单",
        kind: "music",
        sourceType: "manual",
        itemCount: 2,
        cachedItemCount: 2
      },
      items: [
        {
          id: "playlist-item-1",
          sourceContentId: "content-1",
          localAudioAssetId: "asset-1",
          position: 1,
          title: "Song 1",
          coverUrl: "/api/v1/contents/experimental/local-audio/BV1/audio",
          durationSeconds: 120,
          audioUrl: "/api/v1/contents/experimental/local-audio/BV1/audio",
          cacheKey: "BV1",
          status: "ready"
        }
      ]
    });

    expect(parsed.playlist.kind).toBe("music");
    expect(parsed.items[0]?.status).toBe("ready");
  });

  it("keeps the bilibili favorite preview response contract", () => {
    const parsed = bilibiliFavoritePreviewResponseSchema.parse({
      collectionId: "collection-1",
      mediaId: "123456",
      title: "我的收藏夹",
      items: [
        {
          id: "collection-item-1",
          bvid: "BV1B7411m7LV",
          title: "Song 1",
          url: "https://www.bilibili.com/video/BV1B7411m7LV",
          coverUrl: null,
          ownerName: "UP",
          durationSeconds: 120,
          isExcluded: false
        }
      ]
    });

    expect(parsed.collectionId).toBe("collection-1");
    expect(parsed.items[0]?.isExcluded).toBe(false);
  });

  it("keeps the formal import preview response contract", () => {
    const parsed = importPreviewResponseSchema.parse({
      collectionId: "collection-1",
      mediaId: "3960775205",
      title: "歌单？",
      sourceType: "playlist",
      totalCount: 123,
      items: [
        {
          id: "collection-item-1",
          sourceContentId: "content-1",
          bvid: "BV1B7411m7LV",
          title: "Song 1",
          url: "https://www.bilibili.com/video/BV1B7411m7LV",
          coverUrl: "https://i0.hdslb.com/cover.jpg",
          ownerName: "UP",
          durationSeconds: 120,
          isExcluded: false,
          cacheStatus: "uncached"
        }
      ]
    });

    expect(parsed.totalCount).toBe(123);
    expect(parsed.items[0]?.cacheStatus).toBe("uncached");
    expect(modulePrefixes.imports).toBe("imports");
  });

  it("keeps the formal local audio playlist response contract", () => {
    const parsed = localAudioPlaylistResponseSchema.parse({
      playlist: {
        id: "playlist-1",
        name: "我的本地听单",
        kind: "music",
        sourceType: "manual",
        itemCount: 1,
        cachedItemCount: 1
      },
      items: [
        {
          id: "playlist-item-1",
          sourceContentId: "content-1",
          localAudioAssetId: "asset-1",
          position: 1,
          title: "Song 1",
          coverUrl: "/api/v1/local-audio/BV1B7411m7LV/cover",
          durationSeconds: 120,
          audioUrl: "/api/v1/local-audio/BV1B7411m7LV/audio",
          cacheKey: "BV1B7411m7LV",
          status: "ready"
        }
      ]
    });

    expect(parsed.items[0]?.audioUrl).toContain("/api/v1/local-audio/");
  });

  it("keeps the task-based local audio cache response contract", () => {
    const parsed = localAudioCacheRequestCreateResponseSchema.parse({
      assetId: "asset-1",
      taskId: "task-1",
      assetStatus: "pending",
      taskStatus: "queued"
    });

    expect(parsed.assetId).toBe("asset-1");
    expect(parsed.taskStatus).toBe("queued");
  });

  it("keeps the local audio task status response contract", () => {
    const parsed = localAudioTaskStatusResponseSchema.parse({
      taskId: "task-1",
      assetId: "asset-1",
      status: "running",
      progress: null,
      errorMessage: null,
      startedAt: "2026-05-16T00:00:00.000Z",
      finishedAt: null,
      artifactReady: false
    });

    expect(parsed.artifactReady).toBe(false);
  });

  it("keeps the local audio client confirmation contracts", () => {
    const request = localAudioConfirmClientCacheRequestSchema.parse({
      sha256: "a".repeat(64),
      sizeBytes: 123,
      clientStorageKind: "opfs",
      clientStorageKey: "tracks/asset-1"
    });
    const response = localAudioConfirmClientCacheResponseSchema.parse({
      assetId: "asset-1",
      status: "ready",
      storageType: "user_device",
      sha256: request.sha256,
      sizeBytes: 123,
      clientCachedAt: "2026-05-16T00:00:00.000Z",
      serverDeletedAt: "2026-05-16T00:00:00.000Z"
    });

    expect(response.storageType).toBe("user_device");
  });
});
