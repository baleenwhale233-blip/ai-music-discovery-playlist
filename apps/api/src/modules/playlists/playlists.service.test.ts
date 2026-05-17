import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { PlaylistsService } from "./playlists.service";

const now = new Date("2026-05-17T00:00:00.000Z");

function createService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    playlist: {
      findMany: async () => [],
      findFirst: async () => null,
      findUnique: async () => null,
      create: async () => undefined,
      update: async () => undefined
    },
    playlistItem: {
      findMany: async () => [],
      createMany: async () => ({ count: 0 }),
      delete: async () => undefined,
      update: async () => undefined
    },
    playlistFavorite: {
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => undefined,
      delete: async () => undefined
    },
    sourceContent: {
      findMany: async () => []
    },
    localAudioAsset: {
      findMany: async () => []
    },
    conversionTask: {
      findMany: async () => []
    },
    user: {
      findUnique: async () => null
    },
    ...overrides
  };

  return new PlaylistsService(prisma as never);
}

describe("PlaylistsService", () => {
  it("returns playlist detail with owner and current-user cache state", async () => {
    const service = createService({
      playlist: {
        findFirst: async () => ({
          id: "playlist-1",
          userId: "owner-1",
          name: "视频听单",
          description: "从 B 站整理",
          coverUrl: null,
          visibility: "PUBLIC",
          sourceType: "IMPORTED_COLLECTION",
          isEditorial: false,
          createdAt: now,
          updatedAt: now,
          user: {
            id: "owner-1",
            nickname: "Owner"
          },
          items: [
            {
              id: "item-1",
              playlistId: "playlist-1",
              sourceContentId: "content-1",
              position: 1,
              titleSnapshot: null,
              coverUrlSnapshot: null,
              durationSecSnapshot: null,
              addedAt: now,
              sourceContent: {
                id: "content-1",
                platform: "BILIBILI",
                canonicalUrl: "https://www.bilibili.com/video/BV1B7411m7LV",
                title: "Song 1",
                coverUrl: null,
                authorNameSnapshot: "UP",
                durationSec: 120
              }
            }
          ]
        })
      },
      playlistFavorite: {
        findMany: async () => [{ playlistId: "playlist-1" }]
      },
      localAudioAsset: {
        findMany: async () => [
          {
            id: "asset-1",
            sourceContentId: "content-1",
            status: "READY",
            storageType: "SELF_HOSTED_NODE"
          }
        ]
      }
    });

    const result = await service.getPlaylistForUser("viewer-1", "playlist-1");

    expect(result.playlist.isOwner).toBe(false);
    expect(result.playlist.favoritedByCurrentUser).toBe(true);
    expect(result.playlist.cachedCountForCurrentUser).toBe(1);
    expect(result.playlist.items[0]?.cacheStatusForCurrentUser).toBe("cached");
    expect(result.playlist.items[0]?.audioUrlForCurrentUser).toBe("/api/v1/local-audio/assets/asset-1/download");
  });

  it("blocks non-owners from updating playlists", async () => {
    const service = createService({
      playlist: {
        findUnique: async () => ({
          id: "playlist-1",
          userId: "owner-1"
        })
      }
    });

    await expect(
      service.updatePlaylistForUser("viewer-1", "playlist-1", {
        title: "不能改"
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("toggles playlist favorites for the current user", async () => {
    const service = createService({
      playlist: {
        findFirst: async () => ({
          id: "playlist-1"
        })
      },
      playlistFavorite: {
        create: async () => ({
          playlistId: "playlist-1"
        }),
        findUnique: async () => ({
          id: "favorite-1",
          playlistId: "playlist-1"
        }),
        delete: async () => ({
          playlistId: "playlist-1"
        })
      }
    });

    await expect(service.favoritePlaylistForUser("user-1", "playlist-1")).resolves.toEqual({
      playlistId: "playlist-1",
      favoritedByCurrentUser: true
    });
    await expect(service.unfavoritePlaylistForUser("user-1", "playlist-1")).resolves.toEqual({
      playlistId: "playlist-1",
      favoritedByCurrentUser: false
    });
  });

  it("reorders playlist items for owners", async () => {
    const updates: Array<{ id: string; position: number }> = [];
    const service = createService({
      playlist: {
        findUnique: async () => ({
          id: "playlist-1",
          userId: "owner-1"
        }),
        findFirst: async () => ({
          id: "playlist-1",
          userId: "owner-1",
          name: "视频听单",
          description: null,
          coverUrl: null,
          visibility: "PUBLIC",
          sourceType: "MANUAL",
          isEditorial: false,
          createdAt: now,
          updatedAt: now,
          user: {
            id: "owner-1",
            nickname: "Owner"
          },
          items: []
        })
      },
      playlistItem: {
        update: async (input: { where: { id: string }; data: { position: number } }) => {
          updates.push({
            id: input.where.id,
            position: input.data.position
          });
        }
      }
    });

    await service.reorderItemsForUser("owner-1", "playlist-1", {
      itemIds: ["item-2", "item-1"]
    });

    expect(updates).toEqual([
      { id: "item-2", position: 1 },
      { id: "item-1", position: 2 }
    ]);
  });

  it("throws not found when playlist is not visible to user", async () => {
    const service = createService();

    await expect(service.getPlaylistForUser("user-1", "missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
