import { z } from "zod";

export const modulePrefixes = {
  auth: "auth",
  users: "users",
  contents: "contents",
  imports: "imports",
  playlists: "playlists",
  localAudio: "local-audio",
  favorites: "favorites",
  history: "history",
  discovery: "discovery",
  sourceAccounts: "source-accounts",
  moderation: "moderation",
  admin: "admin"
} as const;

export const healthResponseSchema = z.object({
  name: z.string(),
  version: z.string(),
  prefix: z.string(),
  timestamp: z.string()
});

export const authRequestCodeSchema = z.object({
  phoneOrEmail: z.string().min(3).optional(),
  phoneNumber: z.string().min(6).optional(),
  inviteCode: z.string().min(1).optional(),
  scenario: z.enum(["login", "bind-source-account"]).default("login")
}).refine((value) => Boolean(value.phoneOrEmail ?? value.phoneNumber), {
  message: "phoneOrEmail or phoneNumber is required"
});

export const authVerifyCodeSchema = z.object({
  phoneOrEmail: z.string().min(3).optional(),
  phoneNumber: z.string().min(6).optional(),
  code: z.string().min(4),
  inviteCode: z.string().min(1).optional(),
  scenario: z.enum(["login", "bind-source-account"]).default("login")
}).refine((value) => Boolean(value.phoneOrEmail ?? value.phoneNumber), {
  message: "phoneOrEmail or phoneNumber is required"
});

export const authUserSchema = z.object({
  id: z.string(),
  phoneOrEmail: z.string(),
  nickname: z.string()
});

export const authVerifyCodeResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  user: authUserSchema.optional()
});

export const bilibiliParseRequestSchema = z.object({
  url: z.string().min(1)
});

export const bilibiliParseResponseSchema = z.object({
  sourceUrl: z.string(),
  normalizedUrl: z.string(),
  bvid: z.string(),
  cid: z.number(),
  page: z.number(),
  title: z.string(),
  coverUrl: z.string().nullable(),
  ownerName: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  embedUrl: z.string()
});

export const localAudioCacheRequestSchema = z.object({
  url: z.string().min(1)
});

export const localAudioCacheResponseSchema = z.object({
  cacheKey: z.string(),
  sourceUrl: z.string(),
  normalizedUrl: z.string(),
  title: z.string(),
  bvid: z.string(),
  audioUrl: z.string(),
  coverUrl: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  cached: z.boolean(),
  message: z.string()
});

export const bilibiliFavoritePreviewRequestSchema = z.object({
  url: z.string().min(1),
  limit: z.number().min(1).max(50).default(20)
});

export const bilibiliFavoritePreviewItemSchema = z.object({
  id: z.string(),
  bvid: z.string(),
  title: z.string(),
  url: z.string(),
  coverUrl: z.string().nullable(),
  ownerName: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  isExcluded: z.boolean()
});

export const bilibiliFavoritePreviewResponseSchema = z.object({
  collectionId: z.string(),
  mediaId: z.string(),
  title: z.string().nullable(),
  totalCount: z.number().optional(),
  items: z.array(bilibiliFavoritePreviewItemSchema)
});

export const importPreviewRequestSchema = z.object({
  url: z.string().min(1),
  limit: z.number().min(1).max(1000).default(500)
});

export const importCandidateCacheStatusSchema = z.enum([
  "uncached",
  "caching",
  "cached",
  "failed"
]);

export const importPreviewItemSchema = z.object({
  id: z.string(),
  sourceContentId: z.string(),
  bvid: z.string(),
  title: z.string(),
  url: z.string(),
  coverUrl: z.string().nullable(),
  ownerName: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  isExcluded: z.boolean(),
  cacheStatus: importCandidateCacheStatusSchema
});

export const importPreviewResponseSchema = z.object({
  collectionId: z.string(),
  mediaId: z.string(),
  title: z.string().nullable(),
  sourceType: z.enum(["single", "favorites", "playlist", "medialist", "collection"]),
  totalCount: z.number(),
  items: z.array(importPreviewItemSchema)
});

export const importItemsUpdateRequestSchema = z.object({
  excludedItemIds: z.array(z.string()).default([])
});

export const importItemsUpdateResponseSchema = z.object({
  collectionId: z.string(),
  excludedItemIds: z.array(z.string()),
  updatedCount: z.number()
});

export const importCacheRequestSchema = z.object({
  itemIds: z.array(z.string()).optional(),
  sourceContentIds: z.array(z.string()).optional()
});

export const localAudioAssetStatusSchema = z.enum(["pending", "caching", "ready", "failed", "deleted"]);
export const localAudioStorageTypeSchema = z.enum(["self_hosted_node", "cloud_temp", "user_device"]);
export const conversionTaskStatusSchema = z.enum(["created", "queued", "running", "succeeded", "failed", "canceled"]);

export const importCacheResponseSchema = z.object({
  collectionId: z.string(),
  cachedCount: z.number(),
  failedCount: z.number(),
  queuedCount: z.number().optional(),
  playlistItemIds: z.array(z.string()),
  assetIds: z.array(z.string()).optional(),
  taskIds: z.array(z.string()).optional()
});

export const sourceContentCacheResponseSchema = z.object({
  sourceContentId: z.string(),
  assetId: z.string(),
  taskId: z.string(),
  assetStatus: localAudioAssetStatusSchema,
  taskStatus: conversionTaskStatusSchema,
  message: z.string()
});

export const experimentalPlaylistSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["music", "learning", "mixed"]),
  sourceType: z.enum(["manual", "imported_collection", "editorial"]),
  itemCount: z.number(),
  cachedItemCount: z.number()
});

export const experimentalPlaylistItemSchema = z.object({
  id: z.string(),
  sourceContentId: z.string(),
  localAudioAssetId: z.string().nullable(),
  position: z.number(),
  title: z.string(),
  coverUrl: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  audioUrl: z.string().nullable(),
  cacheKey: z.string().nullable(),
  status: z.enum(["pending", "caching", "ready", "failed", "deleted"]).nullable()
});

export const experimentalPlaylistResponseSchema = z.object({
  playlist: experimentalPlaylistSchema,
  items: z.array(experimentalPlaylistItemSchema)
});

export const localAudioPlaylistSchema = experimentalPlaylistSchema;
export const localAudioPlaylistItemSchema = experimentalPlaylistItemSchema;
export const localAudioPlaylistResponseSchema = z.object({
  playlist: localAudioPlaylistSchema,
  items: z.array(localAudioPlaylistItemSchema)
});

export const localAudioCacheRequestCreateSchema = z.object({
  sourceContentId: z.string().min(1),
  playlistId: z.string().min(1).optional(),
  playlistItemId: z.string().min(1).optional()
});

export const localAudioCacheRequestCreateResponseSchema = z.object({
  assetId: z.string(),
  taskId: z.string(),
  assetStatus: localAudioAssetStatusSchema,
  taskStatus: conversionTaskStatusSchema
});

export const localAudioTaskStatusResponseSchema = z.object({
  taskId: z.string(),
  assetId: z.string().nullable(),
  status: conversionTaskStatusSchema,
  progress: z.number().nullable().optional(),
  errorMessage: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  artifactReady: z.boolean()
});

export const localAudioConfirmClientCacheRequestSchema = z.object({
  sha256: z.string().regex(/^[0-9a-f]{64}$/i),
  sizeBytes: z.number().int().nonnegative(),
  clientStorageKind: z.enum(["opfs", "indexeddb", "cache_api", "unknown"]),
  clientStorageKey: z.string().min(1).optional()
});

export const localAudioConfirmClientCacheResponseSchema = z.object({
  assetId: z.string(),
  status: localAudioAssetStatusSchema,
  storageType: localAudioStorageTypeSchema,
  sha256: z.string().nullable(),
  sizeBytes: z.number().nullable(),
  clientCachedAt: z.string().nullable(),
  serverDeletedAt: z.string().nullable()
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type AuthRequestCodeInput = z.infer<typeof authRequestCodeSchema>;
export type AuthVerifyCodeInput = z.infer<typeof authVerifyCodeSchema>;
export type AuthVerifyCodeResponse = z.infer<typeof authVerifyCodeResponseSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type BilibiliParseRequest = z.infer<typeof bilibiliParseRequestSchema>;
export type BilibiliParseResponse = z.infer<typeof bilibiliParseResponseSchema>;
export type LocalAudioCacheRequest = z.infer<typeof localAudioCacheRequestSchema>;
export type LocalAudioCacheResponse = z.infer<typeof localAudioCacheResponseSchema>;
export type BilibiliFavoritePreviewRequest = z.infer<typeof bilibiliFavoritePreviewRequestSchema>;
export type BilibiliFavoritePreviewItem = z.infer<typeof bilibiliFavoritePreviewItemSchema>;
export type BilibiliFavoritePreviewResponse = z.infer<typeof bilibiliFavoritePreviewResponseSchema>;
export type ImportPreviewRequest = z.infer<typeof importPreviewRequestSchema>;
export type ImportPreviewItem = z.infer<typeof importPreviewItemSchema>;
export type ImportPreviewResponse = z.infer<typeof importPreviewResponseSchema>;
export type ImportItemsUpdateRequest = z.infer<typeof importItemsUpdateRequestSchema>;
export type ImportItemsUpdateResponse = z.infer<typeof importItemsUpdateResponseSchema>;
export type ImportCacheRequest = z.infer<typeof importCacheRequestSchema>;
export type ImportCacheResponse = z.infer<typeof importCacheResponseSchema>;
export type SourceContentCacheResponse = z.infer<typeof sourceContentCacheResponseSchema>;
export type ExperimentalPlaylist = z.infer<typeof experimentalPlaylistSchema>;
export type ExperimentalPlaylistItem = z.infer<typeof experimentalPlaylistItemSchema>;
export type ExperimentalPlaylistResponse = z.infer<typeof experimentalPlaylistResponseSchema>;
export type LocalAudioPlaylist = z.infer<typeof localAudioPlaylistSchema>;
export type LocalAudioPlaylistItem = z.infer<typeof localAudioPlaylistItemSchema>;
export type LocalAudioPlaylistResponse = z.infer<typeof localAudioPlaylistResponseSchema>;
export type LocalAudioAssetStatus = z.infer<typeof localAudioAssetStatusSchema>;
export type LocalAudioStorageType = z.infer<typeof localAudioStorageTypeSchema>;
export type ConversionTaskStatus = z.infer<typeof conversionTaskStatusSchema>;
export type LocalAudioCacheRequestCreate = z.infer<typeof localAudioCacheRequestCreateSchema>;
export type LocalAudioCacheRequestCreateResponse = z.infer<typeof localAudioCacheRequestCreateResponseSchema>;
export type LocalAudioTaskStatusResponse = z.infer<typeof localAudioTaskStatusResponseSchema>;
export type LocalAudioConfirmClientCacheRequest = z.infer<typeof localAudioConfirmClientCacheRequestSchema>;
export type LocalAudioConfirmClientCacheResponse = z.infer<typeof localAudioConfirmClientCacheResponseSchema>;
