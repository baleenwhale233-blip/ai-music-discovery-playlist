-- Initial API schema used by the first Web First migration.

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "SourcePlatform" AS ENUM ('BILIBILI', 'DOUYIN');

-- CreateEnum
CREATE TYPE "VerificationTaskStatus" AS ENUM ('CREATED', 'PENDING_USER_ACTION', 'PENDING_CHECK', 'VERIFIED', 'REJECTED', 'EXPIRED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PlaybackStatus" AS ENUM ('PLAYABLE', 'BLOCKED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "PlaylistVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('AI_ORIGINAL', 'AI_COVER', 'STYLE_REMIX', 'UNKNOWN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone_or_email" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "avatar_url" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_accounts" (
    "id" TEXT NOT NULL,
    "platform" "SourcePlatform" NOT NULL,
    "platform_account_id" TEXT NOT NULL,
    "platform_unique_handle" TEXT,
    "display_name" TEXT NOT NULL,
    "profile_url" TEXT,
    "avatar_url" TEXT,
    "verification_status" "VerificationTaskStatus" NOT NULL DEFAULT 'CREATED',
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_contents" (
    "id" TEXT NOT NULL,
    "platform" "SourcePlatform" NOT NULL,
    "platform_content_id" TEXT NOT NULL,
    "canonical_url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cover_url" TEXT,
    "author_name_snapshot" TEXT,
    "source_account_id" TEXT,
    "duration_sec" INTEGER,
    "publish_time" TIMESTAMP(3),
    "playable_status" "PlaybackStatus" NOT NULL DEFAULT 'UNKNOWN',
    "import_status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "raw_payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cover_url" TEXT,
    "description" TEXT,
    "visibility" "PlaylistVisibility" NOT NULL DEFAULT 'PRIVATE',
    "is_editorial" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlist_items" (
    "id" TEXT NOT NULL,
    "playlist_id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "added_by_user_id" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "play_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "playlist_id" TEXT,
    "played_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "play_start_source" TEXT,
    "completion_ratio" DOUBLE PRECISION,
    "end_reason" TEXT,

    CONSTRAINT "play_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_meta" (
    "id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "style_tags" TEXT[],
    "mood_tags" TEXT[],
    "content_type" "ContentType" NOT NULL DEFAULT 'UNKNOWN',
    "model_name" TEXT,
    "short_note" TEXT,
    "meta_source" TEXT,
    "confidence_score" DOUBLE PRECISION,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_or_verification_tasks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "platform" "SourcePlatform" NOT NULL,
    "target_account_hint" TEXT,
    "verification_code" TEXT NOT NULL,
    "verification_method" TEXT NOT NULL,
    "status" "VerificationTaskStatus" NOT NULL DEFAULT 'CREATED',
    "submitted_evidence_json" JSONB,
    "review_result" TEXT,
    "reviewed_by" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_or_verification_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_or_email_key" ON "users"("phone_or_email");

-- CreateIndex
CREATE INDEX "source_accounts_platform_platform_unique_handle_idx" ON "source_accounts"("platform", "platform_unique_handle");

-- CreateIndex
CREATE UNIQUE INDEX "source_accounts_platform_platform_account_id_key" ON "source_accounts"("platform", "platform_account_id");

-- CreateIndex
CREATE INDEX "source_contents_source_account_id_idx" ON "source_contents"("source_account_id");

-- CreateIndex
CREATE INDEX "source_contents_created_at_idx" ON "source_contents"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "source_contents_platform_platform_content_id_key" ON "source_contents"("platform", "platform_content_id");

-- CreateIndex
CREATE INDEX "playlists_user_id_idx" ON "playlists"("user_id");

-- CreateIndex
CREATE INDEX "playlist_items_playlist_id_position_idx" ON "playlist_items"("playlist_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "playlist_items_playlist_id_content_id_key" ON "playlist_items"("playlist_id", "content_id");

-- CreateIndex
CREATE INDEX "favorites_user_id_created_at_idx" ON "favorites"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_content_id_key" ON "favorites"("user_id", "content_id");

-- CreateIndex
CREATE INDEX "play_history_user_id_played_at_idx" ON "play_history"("user_id", "played_at");

-- CreateIndex
CREATE INDEX "play_history_content_id_played_at_idx" ON "play_history"("content_id", "played_at");

-- CreateIndex
CREATE UNIQUE INDEX "content_meta_content_id_key" ON "content_meta"("content_id");

-- CreateIndex
CREATE INDEX "content_meta_content_type_idx" ON "content_meta"("content_type");

-- CreateIndex
CREATE INDEX "claim_or_verification_tasks_user_id_idx" ON "claim_or_verification_tasks"("user_id");

-- CreateIndex
CREATE INDEX "claim_or_verification_tasks_status_idx" ON "claim_or_verification_tasks"("status");

-- CreateIndex
CREATE INDEX "claim_or_verification_tasks_expires_at_idx" ON "claim_or_verification_tasks"("expires_at");

-- AddForeignKey
ALTER TABLE "source_contents" ADD CONSTRAINT "source_contents_source_account_id_fkey" FOREIGN KEY ("source_account_id") REFERENCES "source_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "source_contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "source_contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "play_history" ADD CONSTRAINT "play_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "play_history" ADD CONSTRAINT "play_history_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "source_contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_meta" ADD CONSTRAINT "content_meta_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "source_contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_or_verification_tasks" ADD CONSTRAINT "claim_or_verification_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
