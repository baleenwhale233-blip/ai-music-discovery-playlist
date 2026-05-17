import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  playlistCreateRequestSchema,
  playlistItemAddRequestSchema,
  playlistItemReorderRequestSchema,
  playlistUpdateRequestSchema,
  type LocalAudioPlaylistResponse
} from "@ai-music-playlist/api-contract";

import type { AlphaAccessTokenPayload } from "../auth/alpha-auth";
import { AlphaAuthGuard } from "../auth/alpha-auth.guard";
import { CurrentAlphaUser } from "../auth/current-alpha-user.decorator";
import { ContentsService } from "../contents/contents.service";
import { PlaylistsService } from "./playlists.service";

@Controller("playlists")
@UseGuards(AlphaAuthGuard)
export class PlaylistsController {
  constructor(
    @Inject(ContentsService) private readonly contentsService: ContentsService,
    @Inject(PlaylistsService) private readonly playlistsService: PlaylistsService,
  ) {
    this.getLocalAudioPlaylist = this.getLocalAudioPlaylist.bind(this);
    this.removeLocalAudioPlaylistItem = this.removeLocalAudioPlaylistItem.bind(this);
    this.clearLocalAudioPlaylist = this.clearLocalAudioPlaylist.bind(this);
    this.list = this.list.bind(this);
    this.create = this.create.bind(this);
    this.detail = this.detail.bind(this);
    this.update = this.update.bind(this);
    this.addItems = this.addItems.bind(this);
    this.removeItem = this.removeItem.bind(this);
    this.reorderItems = this.reorderItems.bind(this);
    this.favorite = this.favorite.bind(this);
    this.unfavorite = this.unfavorite.bind(this);
  }

  @Get("local-audio")
  getLocalAudioPlaylist(
    @CurrentAlphaUser() user: AlphaAccessTokenPayload,
  ): Promise<LocalAudioPlaylistResponse> {
    return this.contentsService.getLocalAudioPlaylistForUser(user.userId);
  }

  @Delete("local-audio/items/:playlistItemId")
  removeLocalAudioPlaylistItem(
    @CurrentAlphaUser() user: AlphaAccessTokenPayload,
    @Param("playlistItemId") playlistItemId: string,
  ) {
    return this.contentsService.removeLocalAudioPlaylistItemForUser(user.userId, playlistItemId);
  }

  @Delete("local-audio")
  clearLocalAudioPlaylist(@CurrentAlphaUser() user: AlphaAccessTokenPayload) {
    return this.contentsService.clearLocalAudioPlaylistForUser(user.userId);
  }

  @Get()
  list(@CurrentAlphaUser() user: AlphaAccessTokenPayload) {
    return this.playlistsService.listPlaylistsForUser(user.userId);
  }

  @Post()
  create(@CurrentAlphaUser() user: AlphaAccessTokenPayload, @Body() body: unknown) {
    return this.playlistsService.createPlaylistForUser(user.userId, playlistCreateRequestSchema.parse(body));
  }

  @Get(":playlistId")
  detail(@CurrentAlphaUser() user: AlphaAccessTokenPayload, @Param("playlistId") playlistId: string) {
    return this.playlistsService.getPlaylistForUser(user.userId, playlistId);
  }

  @Patch(":playlistId")
  update(
    @CurrentAlphaUser() user: AlphaAccessTokenPayload,
    @Param("playlistId") playlistId: string,
    @Body() body: unknown,
  ) {
    return this.playlistsService.updatePlaylistForUser(
      user.userId,
      playlistId,
      playlistUpdateRequestSchema.parse(body),
    );
  }

  @Post(":playlistId/items")
  addItems(
    @CurrentAlphaUser() user: AlphaAccessTokenPayload,
    @Param("playlistId") playlistId: string,
    @Body() body: unknown,
  ) {
    return this.playlistsService.addItemsForUser(user.userId, playlistId, playlistItemAddRequestSchema.parse(body));
  }

  @Delete(":playlistId/items/:itemId")
  removeItem(
    @CurrentAlphaUser() user: AlphaAccessTokenPayload,
    @Param("playlistId") playlistId: string,
    @Param("itemId") itemId: string,
  ) {
    return this.playlistsService.removeItemForUser(user.userId, playlistId, itemId);
  }

  @Patch(":playlistId/items/reorder")
  reorderItems(
    @CurrentAlphaUser() user: AlphaAccessTokenPayload,
    @Param("playlistId") playlistId: string,
    @Body() body: unknown,
  ) {
    return this.playlistsService.reorderItemsForUser(
      user.userId,
      playlistId,
      playlistItemReorderRequestSchema.parse(body),
    );
  }

  @Post(":playlistId/favorite")
  favorite(@CurrentAlphaUser() user: AlphaAccessTokenPayload, @Param("playlistId") playlistId: string) {
    return this.playlistsService.favoritePlaylistForUser(user.userId, playlistId);
  }

  @Delete(":playlistId/favorite")
  unfavorite(@CurrentAlphaUser() user: AlphaAccessTokenPayload, @Param("playlistId") playlistId: string) {
    return this.playlistsService.unfavoritePlaylistForUser(user.userId, playlistId);
  }
}
