import { Module } from "@nestjs/common";

import { PrismaModule } from "../../platform/prisma/prisma.module";
import { AlphaAuthGuard } from "./alpha-auth.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, AlphaAuthGuard],
  exports: [AlphaAuthGuard]
})
export class AuthModule {}
