-- Local audio task-based staging lifecycle metadata.

ALTER TABLE "local_audio_assets"
ADD COLUMN "sha256" TEXT,
ADD COLUMN "server_artifact_expires_at" TIMESTAMP(3),
ADD COLUMN "client_cached_at" TIMESTAMP(3),
ADD COLUMN "server_deleted_at" TIMESTAMP(3),
ADD COLUMN "client_storage_kind" TEXT,
ADD COLUMN "client_storage_key" TEXT;

CREATE INDEX "local_audio_assets_storage_type_status_server_artifact_expires_at_idx"
ON "local_audio_assets"("storage_type", "status", "server_artifact_expires_at");
