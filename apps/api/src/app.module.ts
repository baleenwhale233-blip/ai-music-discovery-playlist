import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppConfigModule } from "./config/app-config.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ContentsModule } from "./modules/contents/contents.module";
import { DiscoveryModule } from "./modules/discovery/discovery.module";
import { FavoritesModule } from "./modules/favorites/favorites.module";
import { HealthModule } from "./modules/health/health.module";
import { HistoryModule } from "./modules/history/history.module";
import { ImportsModule } from "./modules/imports/imports.module";
import { ModerationModule } from "./modules/moderation/moderation.module";
import { PlaylistsModule } from "./modules/playlists/playlists.module";
import { SourceAccountsModule } from "./modules/source-accounts/source-accounts.module";
import { UsersModule } from "./modules/users/users.module";
import { PrismaModule } from "./platform/prisma/prisma.module";
import { QueueModule } from "./platform/queue/queue.module";
import { RedisModule } from "./platform/redis/redis.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    AppConfigModule,
    PrismaModule,
    RedisModule,
    QueueModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ContentsModule,
    ImportsModule,
    PlaylistsModule,
    FavoritesModule,
    HistoryModule,
    DiscoveryModule,
    SourceAccountsModule,
    ModerationModule,
    AdminModule
  ]
})
export class AppModule {}
