import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  MeLibraryResponse,
  PlaylistCreateRequest,
  PlaylistDetailResponse,
  PlaylistFavoriteResponse,
  PlaylistItemAddRequest,
  PlaylistItemCacheStatusForCurrentUser,
  PlaylistItemReorderRequest,
  PlaylistListResponse,
  PlaylistSourceTypeSummary,
  PlaylistSummary,
  PlaylistUpdateRequest
} from "@ai-music-playlist/api-contract";

import { PrismaService } from "../../platform/prisma/prisma.service";
import { buildBilibiliCoverProxyPath } from "../contents/bilibili-cover";
import { buildLocalAudioPlaylistResponse } from "../contents/local-audio-playlist";

type PrismaDelegate = {
  findMany(input?: unknown): Promise<unknown[]>;
  findFirst?(input?: unknown): Promise<unknown | null>;
  findUnique?(input?: unknown): Promise<unknown | null>;
  findUniqueOrThrow?(input?: unknown): Promise<unknown>;
  create?(input?: unknown): Promise<unknown>;
  createMany?(input?: unknown): Promise<unknown>;
  update?(input?: unknown): Promise<unknown>;
  delete?(input?: unknown): Promise<unknown>;
};

type PrismaPlaylistClient = {
  playlist: PrismaDelegate;
  playlistItem: PrismaDelegate;
  playlistFavorite: PrismaDelegate;
  sourceContent: PrismaDelegate;
  localAudioAsset: PrismaDelegate;
  conversionTask: PrismaDelegate;
  user: PrismaDelegate;
};

type UserRecord = {
  id: string;
  phoneOrEmail?: string;
  nickname: string;
};

type SourceContentRecord = {
  id: string;
  platform: string;
  canonicalUrl: string;
  title: string;
  coverUrl: string | null;
  authorNameSnapshot: string | null;
  durationSec: number | null;
};

type PlaylistItemRecord = {
  id: string;
  playlistId: string;
  sourceContentId: string;
  position: number;
  titleSnapshot: string | null;
  coverUrlSnapshot: string | null;
  durationSecSnapshot: number | null;
  addedAt: Date;
  sourceContent: SourceContentRecord;
};

type PlaylistRecord = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  visibility: string;
  sourceType: string;
  isEditorial: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: UserRecord;
  items: PlaylistItemRecord[];
};

type PlaylistFavoriteRecord = {
  id?: string;
  playlistId: string;
  playlist?: PlaylistRecord;
};

type LocalAudioAssetRecord = {
  id: string;
  sourceContentId: string;
  status: string;
  storageType?: string | null;
};

type ConversionTaskRecord = {
  sourceContentId: string | null;
  status: string;
};

const playlistInclude = {
  user: true,
  items: {
    include: {
      sourceContent: true
    },
    orderBy: {
      position: "asc"
    }
  }
};

@Injectable()
export class PlaylistsService {
  constructor(@Inject(PrismaService) prisma: PrismaPlaylistClient) {
    this.prisma = prisma;
  }

  private readonly prisma: PrismaPlaylistClient;

  async listPlaylistsForUser(userId: string): Promise<PlaylistListResponse> {
    const playlists = await this.prisma.playlist.findMany({
      where: this.visiblePlaylistWhere(userId),
      include: playlistInclude,
      orderBy: {
        updatedAt: "desc"
      }
    }) as PlaylistRecord[];

    return {
      playlists: await this.buildSummaries(userId, playlists)
    };
  }

  async createPlaylistForUser(userId: string, input: PlaylistCreateRequest): Promise<PlaylistDetailResponse> {
    const playlist = await this.prisma.playlist.create?.({
      data: {
        userId,
        name: input.title.trim(),
        description: input.description?.trim() || null,
        visibility: toDbVisibility(input.visibility),
        kind: "MUSIC",
        sourceType: "MANUAL",
        itemCount: 0,
        cachedItemCount: 0,
        isEditorial: false
      }
    }) as { id: string } | undefined;

    if (!playlist) {
      throw new BadRequestException("Unable to create playlist");
    }

    return this.getPlaylistForUser(userId, playlist.id);
  }

  async getPlaylistForUser(userId: string, playlistId: string): Promise<PlaylistDetailResponse> {
    const playlist = await this.prisma.playlist.findFirst?.({
      where: {
        id: playlistId,
        ...this.visiblePlaylistWhere(userId)
      },
      include: playlistInclude
    }) as PlaylistRecord | null;

    if (!playlist) {
      throw new NotFoundException("Playlist not found");
    }

    const summaries = await this.buildSummaries(userId, [playlist]);
    const summary = summaries[0];

    if (!summary) {
      throw new NotFoundException("Playlist not found");
    }

    const assets = await this.findAssetsForItems(userId, playlist.items);
    const tasks = await this.findTasksForItems(userId, playlist.items);

    return {
      playlist: {
        ...summary,
        items: playlist.items.map((item) => this.toItemContract(item, assets, tasks))
      }
    };
  }

  async updatePlaylistForUser(
    userId: string,
    playlistId: string,
    input: PlaylistUpdateRequest,
  ): Promise<PlaylistDetailResponse> {
    await this.assertOwner(userId, playlistId);

    await this.prisma.playlist.update?.({
      where: {
        id: playlistId
      },
      data: {
        ...(input.title !== undefined ? { name: input.title.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.visibility !== undefined ? { visibility: toDbVisibility(input.visibility) } : {})
      }
    });

    return this.getPlaylistForUser(userId, playlistId);
  }

  async addItemsForUser(
    userId: string,
    playlistId: string,
    input: PlaylistItemAddRequest,
  ): Promise<PlaylistDetailResponse> {
    await this.assertOwner(userId, playlistId);
    const sourceContents = await this.prisma.sourceContent.findMany({
      where: {
        id: {
          in: input.sourceContentIds
        }
      }
    }) as SourceContentRecord[];
    const existingItems = await this.prisma.playlistItem.findMany({
      where: {
        playlistId
      }
    }) as Array<{ position: number }>;
    let nextPosition = existingItems.reduce((max, item) => Math.max(max, item.position), 0) + 1;

    await this.prisma.playlistItem.createMany?.({
      data: sourceContents.map((content) => ({
        playlistId,
        sourceContentId: content.id,
        position: nextPosition++,
        titleSnapshot: content.title,
        coverUrlSnapshot: content.coverUrl,
        durationSecSnapshot: content.durationSec,
        addedByUserId: userId
      })),
      skipDuplicates: true
    });

    return this.getPlaylistForUser(userId, playlistId);
  }

  async removeItemForUser(userId: string, playlistId: string, itemId: string): Promise<PlaylistDetailResponse> {
    await this.assertOwner(userId, playlistId);
    await this.prisma.playlistItem.delete?.({
      where: {
        id: itemId
      }
    });

    return this.getPlaylistForUser(userId, playlistId);
  }

  async reorderItemsForUser(
    userId: string,
    playlistId: string,
    input: PlaylistItemReorderRequest,
  ): Promise<PlaylistDetailResponse> {
    await this.assertOwner(userId, playlistId);

    for (const [index, itemId] of input.itemIds.entries()) {
      await this.prisma.playlistItem.update?.({
        where: {
          id: itemId
        },
        data: {
          position: index + 1
        }
      });
    }

    return this.getPlaylistForUser(userId, playlistId);
  }

  async favoritePlaylistForUser(userId: string, playlistId: string): Promise<PlaylistFavoriteResponse> {
    await this.assertVisible(userId, playlistId);
    await this.prisma.playlistFavorite.create?.({
      data: {
        userId,
        playlistId
      }
    }).catch(() => undefined);

    return {
      playlistId,
      favoritedByCurrentUser: true
    };
  }

  async unfavoritePlaylistForUser(userId: string, playlistId: string): Promise<PlaylistFavoriteResponse> {
    const favorite = await this.prisma.playlistFavorite.findUnique?.({
      where: {
        userId_playlistId: {
          userId,
          playlistId
        }
      }
    }) as PlaylistFavoriteRecord | null;

    if (favorite?.id) {
      await this.prisma.playlistFavorite.delete?.({
        where: {
          id: favorite.id
        }
      });
    }

    return {
      playlistId,
      favoritedByCurrentUser: false
    };
  }

  async getMeLibraryForUser(userId: string): Promise<MeLibraryResponse> {
    const user = await this.prisma.user.findUnique?.({
      where: {
        id: userId
      }
    }) as Required<UserRecord> | null;

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const created = await this.prisma.playlist.findMany({
      where: {
        userId,
        NOT: {
          name: "我的本地听单"
        }
      },
      include: playlistInclude,
      orderBy: {
        updatedAt: "desc"
      }
    }) as PlaylistRecord[];
    const favorites = await this.prisma.playlistFavorite.findMany({
      where: {
        userId
      },
      include: {
        playlist: {
          include: playlistInclude
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    }) as PlaylistFavoriteRecord[];
    const favoritePlaylists = favorites
      .map((favorite) => favorite.playlist)
      .filter((playlist): playlist is PlaylistRecord => Boolean(playlist));
    const localAudioPlaylist = await this.prisma.playlist.findFirst?.({
      where: {
        userId,
        name: "我的本地听单"
      },
      include: {
        items: {
          include: {
            sourceContent: true,
            localAudioAsset: true
          },
          orderBy: {
            addedAt: "desc"
          }
        }
      }
    }) as Parameters<typeof buildLocalAudioPlaylistResponse>[0]["playlist"] & { items?: unknown[] } | null;

    return {
      user: {
        id: user.id,
        phoneOrEmail: user.phoneOrEmail,
        nickname: user.nickname
      },
      createdPlaylists: await this.buildSummaries(userId, created),
      favoritePlaylists: await this.buildSummaries(userId, favoritePlaylists),
      recentLocalAudioItems: localAudioPlaylist
        ? buildLocalAudioPlaylistResponse({
          playlist: localAudioPlaylist,
          items: (localAudioPlaylist.items ?? []) as Parameters<typeof buildLocalAudioPlaylistResponse>[0]["items"]
        }).items.slice(0, 12)
        : []
    };
  }

  private visiblePlaylistWhere(userId: string) {
    return {
      NOT: {
        name: "我的本地听单"
      },
      OR: [
        {
          visibility: "PUBLIC"
        },
        {
          userId
        },
        {
          isEditorial: true
        },
        {
          playlistFavorites: {
            some: {
              userId
            }
          }
        }
      ]
    };
  }

  private async assertVisible(userId: string, playlistId: string) {
    const playlist = await this.prisma.playlist.findFirst?.({
      where: {
        id: playlistId,
        ...this.visiblePlaylistWhere(userId)
      }
    });

    if (!playlist) {
      throw new NotFoundException("Playlist not found");
    }
  }

  private async assertOwner(userId: string, playlistId: string) {
    const playlist = await this.prisma.playlist.findUnique?.({
      where: {
        id: playlistId
      }
    }) as { userId: string } | null;

    if (!playlist) {
      throw new NotFoundException("Playlist not found");
    }

    if (playlist.userId !== userId) {
      throw new ForbiddenException("Only the playlist owner can manage this playlist");
    }
  }

  private async buildSummaries(userId: string, playlists: PlaylistRecord[]): Promise<PlaylistSummary[]> {
    const favorites = await this.prisma.playlistFavorite.findMany({
      where: {
        userId,
        playlistId: {
          in: playlists.map((playlist) => playlist.id)
        }
      }
    }) as PlaylistFavoriteRecord[];
    const favoriteIds = new Set(favorites.map((favorite) => favorite.playlistId));

    return Promise.all(playlists.map(async (playlist) => {
      const assets = await this.findAssetsForItems(userId, playlist.items);
      const cachedCount = playlist.items.filter((item) => assets.get(item.sourceContentId)?.status === "READY").length;
      const coverItems = playlist.items
        .map((item) => buildCoverUrl(item.coverUrlSnapshot ?? item.sourceContent.coverUrl))
        .filter((coverUrl): coverUrl is string => Boolean(coverUrl))
        .slice(0, 4);

      return {
        id: playlist.id,
        ownerUserId: playlist.userId,
        ownerDisplayName: playlist.user.nickname,
        title: playlist.name,
        description: playlist.description,
        coverUrl: buildCoverUrl(playlist.coverUrl),
        coverItems,
        visibility: playlist.visibility === "PUBLIC" ? "public" : "private",
        sourceTypeSummary: summarizeSourceType(playlist),
        itemCount: playlist.items.length,
        cachedCountForCurrentUser: cachedCount,
        favoritedByCurrentUser: favoriteIds.has(playlist.id),
        isOwner: playlist.userId === userId,
        isEditorial: playlist.isEditorial,
        createdAt: playlist.createdAt.toISOString(),
        updatedAt: playlist.updatedAt.toISOString()
      };
    }));
  }

  private async findAssetsForItems(userId: string, items: PlaylistItemRecord[]) {
    const assets = await this.prisma.localAudioAsset.findMany({
      where: {
        userId,
        sourceContentId: {
          in: items.map((item) => item.sourceContentId)
        },
        deletedAt: null
      }
    }) as LocalAudioAssetRecord[];

    return new Map(assets.map((asset) => [asset.sourceContentId, asset]));
  }

  private async findTasksForItems(userId: string, items: PlaylistItemRecord[]) {
    const tasks = await this.prisma.conversionTask.findMany({
      where: {
        userId,
        taskType: "CACHE_AUDIO",
        sourceContentId: {
          in: items.map((item) => item.sourceContentId)
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    }) as ConversionTaskRecord[];
    const taskByContentId = new Map<string, ConversionTaskRecord>();

    for (const task of tasks) {
      if (task.sourceContentId && !taskByContentId.has(task.sourceContentId)) {
        taskByContentId.set(task.sourceContentId, task);
      }
    }

    return taskByContentId;
  }

  private toItemContract(
    item: PlaylistItemRecord,
    assets: Map<string, LocalAudioAssetRecord>,
    tasks: Map<string, ConversionTaskRecord>,
  ) {
    const asset = assets.get(item.sourceContentId) ?? null;
    const cacheStatus = toCacheStatus(asset?.status ?? null, tasks.get(item.sourceContentId)?.status ?? null);
    const title = item.titleSnapshot ?? item.sourceContent.title;
    const coverUrl = buildCoverUrl(item.coverUrlSnapshot ?? item.sourceContent.coverUrl);

    return {
      id: item.id,
      playlistId: item.playlistId,
      sourcePlatform: item.sourceContent.platform === "BILIBILI" ? "bilibili" as const : "other" as const,
      sourceUrl: item.sourceContent.canonicalUrl,
      sourceContentId: item.sourceContentId,
      sourceAuthorName: item.sourceContent.authorNameSnapshot,
      title,
      coverUrl,
      durationSeconds: item.durationSecSnapshot ?? item.sourceContent.durationSec,
      orderIndex: item.position,
      cacheStatusForCurrentUser: cacheStatus,
      localAudioAssetIdForCurrentUser: asset?.id ?? null,
      audioUrlForCurrentUser: asset?.id && cacheStatus === "cached" && asset.storageType !== "USER_DEVICE"
        ? `/api/v1/local-audio/assets/${encodeURIComponent(asset.id)}/download`
        : null,
      createdAt: item.addedAt.toISOString()
    };
  }
}

function toDbVisibility(visibility: "private" | "public") {
  return visibility === "public" ? "PUBLIC" : "PRIVATE";
}

function buildCoverUrl(url: string | null) {
  return buildBilibiliCoverProxyPath(url) ?? url;
}

function summarizeSourceType(playlist: PlaylistRecord): PlaylistSourceTypeSummary {
  if (playlist.items.length === 0) {
    return "manual";
  }

  const platforms = new Set(playlist.items.map((item) => item.sourceContent.platform));

  return platforms.size === 1 && platforms.has("BILIBILI") ? "bilibili" : "mixed";
}

function toCacheStatus(assetStatus: string | null, taskStatus: string | null): PlaylistItemCacheStatusForCurrentUser {
  if (assetStatus === "READY") {
    return "cached";
  }

  if (assetStatus === "FAILED" || taskStatus === "FAILED") {
    return "failed";
  }

  if (taskStatus === "QUEUED" || assetStatus === "PENDING") {
    return "queued";
  }

  if (taskStatus === "RUNNING" || assetStatus === "CACHING") {
    return "converting";
  }

  return "not_cached";
}
