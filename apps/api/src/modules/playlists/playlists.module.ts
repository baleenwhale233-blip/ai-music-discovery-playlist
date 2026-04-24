import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { ContentsModule } from "../contents/contents.module";
import { PlaylistsController } from "./playlists.controller";

@Module({
  imports: [AuthModule, ContentsModule],
  controllers: [PlaylistsController]
})
export class PlaylistsModule {}
