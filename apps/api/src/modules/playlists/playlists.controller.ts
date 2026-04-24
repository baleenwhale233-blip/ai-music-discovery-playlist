import { Controller, Delete, Get, Inject, Param, UseGuards } from "@nestjs/common";
import type { LocalAudioPlaylistResponse } from "@ai-music-playlist/api-contract";

import type { AlphaAccessTokenPayload } from "../auth/alpha-auth";
import { AlphaAuthGuard } from "../auth/alpha-auth.guard";
import { CurrentAlphaUser } from "../auth/current-alpha-user.decorator";
import { ContentsService } from "../contents/contents.service";

@Controller("playlists")
@UseGuards(AlphaAuthGuard)
export class PlaylistsController {
  constructor(@Inject(ContentsService) private readonly contentsService: ContentsService) {
    this.getLocalAudioPlaylist = this.getLocalAudioPlaylist.bind(this);
    this.removeLocalAudioPlaylistItem = this.removeLocalAudioPlaylistItem.bind(this);
    this.clearLocalAudioPlaylist = this.clearLocalAudioPlaylist.bind(this);
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
}
