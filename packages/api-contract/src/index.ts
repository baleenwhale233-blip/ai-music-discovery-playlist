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

export const importCacheResponseSchema = z.object({
  collectionId: z.string(),
  cachedCount: z.number(),
  failedCount: z.number(),
  playlistItemIds: z.array(z.string())
});

export const sourceContentCacheResponseSchema = z.object({
  sourceContentId: z.string(),
  cacheKey: z.string(),
  audioUrl: z.string(),
  coverUrl: z.string().nullable(),
  status: z.enum(["ready", "failed"]),
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
