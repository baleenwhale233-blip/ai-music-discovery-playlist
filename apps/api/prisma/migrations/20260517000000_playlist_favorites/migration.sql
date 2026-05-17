CREATE TABLE "playlist_favorites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "playlist_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlist_favorites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "playlist_favorites_user_id_playlist_id_key" ON "playlist_favorites"("user_id", "playlist_id");
CREATE INDEX "playlist_favorites_user_id_created_at_idx" ON "playlist_favorites"("user_id", "created_at");
CREATE INDEX "playlist_favorites_playlist_id_idx" ON "playlist_favorites"("playlist_id");

ALTER TABLE "playlist_favorites" ADD CONSTRAINT "playlist_favorites_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "playlist_favorites" ADD CONSTRAINT "playlist_favorites_playlist_id_fkey"
  FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
