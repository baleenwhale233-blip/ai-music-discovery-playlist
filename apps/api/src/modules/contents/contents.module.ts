import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { ContentsController } from "./contents.controller";
import { ContentsService } from "./contents.service";
import { LocalAudioController } from "./local-audio.controller";

@Module({
  imports: [AuthModule],
  controllers: [ContentsController, LocalAudioController],
  providers: [ContentsService],
  exports: [ContentsService]
})
export class ContentsModule {}
