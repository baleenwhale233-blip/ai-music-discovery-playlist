import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { ContentsModule } from "../contents/contents.module";
import { ImportsController } from "./imports.controller";

@Module({
  imports: [AuthModule, ContentsModule],
  controllers: [ImportsController]
})
export class ImportsModule {}
