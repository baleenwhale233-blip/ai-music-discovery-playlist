import { Controller, Get, Inject, UseGuards } from "@nestjs/common";

import type { AlphaAccessTokenPayload } from "../auth/alpha-auth";
import { AlphaAuthGuard } from "../auth/alpha-auth.guard";
import { CurrentAlphaUser } from "../auth/current-alpha-user.decorator";
import { PlaylistsService } from "./playlists.service";

@Controller("me")
@UseGuards(AlphaAuthGuard)
export class MeController {
  constructor(@Inject(PlaylistsService) private readonly playlistsService: PlaylistsService) {}

  @Get()
  getMe(@CurrentAlphaUser() user: AlphaAccessTokenPayload) {
    return this.playlistsService.getMeLibraryForUser(user.userId);
  }
}
