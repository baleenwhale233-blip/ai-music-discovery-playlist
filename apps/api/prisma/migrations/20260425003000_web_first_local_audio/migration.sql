-- Web First local audio alpha schema.
-- This migration keeps existing playlist/source-content data where possible.

-- CreateEnum
CREATE TYPE "SourceContentKind" AS ENUM ('MUSIC_VIDEO', 'SHORT_VIDEO', 'TALK_VIDEO', 'UNKNOWN');

-- RenameEnum
ALTER TYPE "PlaybackStatus" RENAME TO "PlaybackAvailability";

-- CreateEnum
CREATE TYPE "PlaylistKind" AS ENUM ('MUSIC', 'LEARNING', 'MIXED');

-- CreateEnum
CREATE TYPE "PlaylistSourceType" AS ENUM ('MANUAL', 'IMPORTED_COLLECTION', 'EDITORIAL');

-- CreateEnum
CREATE TYPE "SourceCollectionType" AS ENUM ('FAVORITES', 'PLAYLIST', 'MEDIALIST', 'MANUAL');

-- CreateEnum
CREATE TYPE "LocalAudioAssetStatus" AS ENUM ('PENDING', 'CACHING', 'READY', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "LocalAudioStorageType" AS ENUM ('SELF_HOSTED_NODE', 'CLOUD_TEMP', 'USER_DEVICE');

-- CreateEnum
CREATE TYPE "ConversionTaskType" AS ENUM ('CACHE_AUDIO', 'DELETE_AUDIO', 'REFRESH_METADATA', 'IMPORT_COLLECTION');

-- CreateEnum
CREATE TYPE "ConversionTaskStatus" AS ENUM ('CREATED', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ConversionRunnerType" AS ENUM ('SELF_HOSTED_NODE', 'CLOUD_NODE', 'UNKNOWN');

-- AlterEnum
ALTER TYPE "SourcePlatform" ADD VALUE 'YOUTUBE';
ALTER TYPE "SourcePlatform" ADD VALUE 'TIKTOK';

-- DropForeignKey
ALTER TABLE "playlist_items" DROP CONSTRAINT "playlist_items_content_id_fkey";

-- DropIndex
DROP INDEX "playlist_items_playlist_id_content_id_key";

-- AlterTable
ALTER TABLE "source_contents" ADD COLUMN "content_kind" "SourceContentKind" NOT NULL DEFAULT 'UNKNOWN';
CREATE INDEX "source_contents_platform_created_at_idx" ON "source_contents"("platform", "created_at");

-- AlterTable
ALTER TABLE "playlists" ADD COLUMN "cached_item_count" INTEGER,
ADD COLUMN "item_count" INTEGER,
ADD COLUMN "kind" "PlaylistKind" NOT NULL DEFAULT 'MUSIC',
ADD COLUMN "source_collection_id" TEXT,
ADD COLUMN "source_type" "PlaylistSourceType" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "playlist_items" RENAME COLUMN "content_id" TO "source_content_id";
ALTER TABLE "playlist_items" ADD COLUMN "cover_url_snapshot" TEXT,
ADD COLUMN "duration_sec_snapshot" INTEGER,
ADD COLUMN "local_audio_asset_id" TEXT,
ADD COLUMN "title_snapshot" TEXT;

-- AlterTable
ALTER TABLE "play_history" ADD COLUMN "local_audio_asset_id" TEXT;

-- CreateTable
CREATE TABLE "source_collections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "platform" "SourcePlatform" NOT NULL,
    "collection_type" "SourceCollectionType" NOT NULL,
    "platform_collection_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "title" TEXT,
    "cover_url" TEXT,
    "owner_name_snapshot" TEXT,
    "item_count_snapshot" INTEGER,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_collection_items" (
    "id" TEXT NOT NULL,
    "source_collection_id" TEXT NOT NULL,
    "source_content_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "is_excluded" BOOLEAN NOT NULL DEFAULT false,
    "exclusion_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_collection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_audio_assets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_content_id" TEXT NOT NULL,
    "cache_key" TEXT NOT NULL,
    "storage_type" "LocalAudioStorageType" NOT NULL DEFAULT 'SELF_HOSTED_NODE',
    "relative_file_path" TEXT,
    "cover_relative_path" TEXT,
    "mime_type" TEXT,
    "file_size_bytes" INTEGER,
    "duration_sec" INTEGER,
    "status" "LocalAudioAssetStatus" NOT NULL DEFAULT 'PENDING',
    "last_error" TEXT,
    "last_accessed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_audio_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversion_tasks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_content_id" TEXT,
    "source_collection_id" TEXT,
    "local_audio_asset_id" TEXT,
    "task_type" "ConversionTaskType" NOT NULL,
    "status" "ConversionTaskStatus" NOT NULL DEFAULT 'CREATED',
    "runner_type" "ConversionRunnerType" NOT NULL DEFAULT 'UNKNOWN',
    "runner_label" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "error_message" TEXT,
    "payload_json" JSONB,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversion_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "source_collections_user_id_created_at_idx" ON "source_collections"("user_id", "created_at");
CREATE UNIQUE INDEX "source_collections_platform_platform_collection_id_key" ON "source_collections"("platform", "platform_collection_id");
CREATE INDEX "source_collection_items_source_collection_id_position_idx" ON "source_collection_items"("source_collection_id", "position");
CREATE UNIQUE INDEX "source_collection_items_source_collection_id_source_content_key" ON "source_collection_items"("source_collection_id", "source_content_id");
CREATE UNIQUE INDEX "local_audio_assets_cache_key_key" ON "local_audio_assets"("cache_key");
CREATE INDEX "local_audio_assets_user_id_status_idx" ON "local_audio_assets"("user_id", "status");
CREATE INDEX "local_audio_assets_source_content_id_status_idx" ON "local_audio_assets"("source_content_id", "status");
CREATE UNIQUE INDEX "local_audio_assets_user_id_source_content_id_key" ON "local_audio_assets"("user_id", "source_content_id");
CREATE INDEX "conversion_tasks_user_id_status_created_at_idx" ON "conversion_tasks"("user_id", "status", "created_at");
CREATE INDEX "conversion_tasks_source_content_id_task_type_idx" ON "conversion_tasks"("source_content_id", "task_type");
CREATE INDEX "conversion_tasks_source_collection_id_task_type_idx" ON "conversion_tasks"("source_collection_id", "task_type");
CREATE INDEX "conversion_tasks_local_audio_asset_id_status_idx" ON "conversion_tasks"("local_audio_asset_id", "status");
CREATE INDEX "playlists_source_collection_id_idx" ON "playlists"("source_collection_id");
CREATE INDEX "playlist_items_local_audio_asset_id_idx" ON "playlist_items"("local_audio_asset_id");
CREATE UNIQUE INDEX "playlist_items_playlist_id_source_content_id_key" ON "playlist_items"("playlist_id", "source_content_id");
CREATE INDEX "play_history_local_audio_asset_id_played_at_idx" ON "play_history"("local_audio_asset_id", "played_at");

-- AddForeignKey
ALTER TABLE "source_collections" ADD CONSTRAINT "source_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "source_collection_items" ADD CONSTRAINT "source_collection_items_source_collection_id_fkey" FOREIGN KEY ("source_collection_id") REFERENCES "source_collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "source_collection_items" ADD CONSTRAINT "source_collection_items_source_content_id_fkey" FOREIGN KEY ("source_content_id") REFERENCES "source_contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_source_collection_id_fkey" FOREIGN KEY ("source_collection_id") REFERENCES "source_collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_source_content_id_fkey" FOREIGN KEY ("source_content_id") REFERENCES "source_contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_local_audio_asset_id_fkey" FOREIGN KEY ("local_audio_asset_id") REFERENCES "local_audio_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "play_history" ADD CONSTRAINT "play_history_local_audio_asset_id_fkey" FOREIGN KEY ("local_audio_asset_id") REFERENCES "local_audio_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "play_history" ADD CONSTRAINT "play_history_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "local_audio_assets" ADD CONSTRAINT "local_audio_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "local_audio_assets" ADD CONSTRAINT "local_audio_assets_source_content_id_fkey" FOREIGN KEY ("source_content_id") REFERENCES "source_contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversion_tasks" ADD CONSTRAINT "conversion_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversion_tasks" ADD CONSTRAINT "conversion_tasks_source_content_id_fkey" FOREIGN KEY ("source_content_id") REFERENCES "source_contents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conversion_tasks" ADD CONSTRAINT "conversion_tasks_source_collection_id_fkey" FOREIGN KEY ("source_collection_id") REFERENCES "source_collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conversion_tasks" ADD CONSTRAINT "conversion_tasks_local_audio_asset_id_fkey" FOREIGN KEY ("local_audio_asset_id") REFERENCES "local_audio_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
