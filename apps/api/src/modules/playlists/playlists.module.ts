import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { ContentsModule } from "../contents/contents.module";
import { MeController } from "./me.controller";
import { PlaylistsController } from "./playlists.controller";
import { PlaylistsService } from "./playlists.service";

@Module({
  imports: [AuthModule, ContentsModule],
  controllers: [PlaylistsController, MeController],
  providers: [PlaylistsService],
  exports: [PlaylistsService]
})
export class PlaylistsModule {}
