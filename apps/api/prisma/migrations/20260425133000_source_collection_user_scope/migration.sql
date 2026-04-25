-- Source collections are user-private imports, not global platform collections.
DROP INDEX IF EXISTS "source_collections_platform_platform_collection_id_key";

CREATE UNIQUE INDEX "source_collections_user_id_platform_platform_collection_id_key"
ON "source_collections"("user_id", "platform", "platform_collection_id");
