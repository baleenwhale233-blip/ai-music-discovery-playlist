import { z } from "zod";

export const modulePrefixes = {
  auth: "auth",
  users: "users",
  contents: "contents",
  imports: "imports",
  playlists: "playlists",
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
  phoneNumber: z.string().min(6),
  scenario: z.enum(["login", "bind-source-account"]).default("login")
});

export const authVerifyCodeSchema = z.object({
  phoneNumber: z.string().min(6),
  code: z.string().min(4),
  scenario: z.enum(["login", "bind-source-account"]).default("login")
});

export const authVerifyCodeResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number()
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
  bvid: z.string(),
  title: z.string(),
  url: z.string(),
  coverUrl: z.string().nullable(),
  ownerName: z.string().nullable(),
  durationSeconds: z.number().nullable()
});

export const bilibiliFavoritePreviewResponseSchema = z.object({
  mediaId: z.string(),
  title: z.string().nullable(),
  items: z.array(bilibiliFavoritePreviewItemSchema)
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type AuthRequestCodeInput = z.infer<typeof authRequestCodeSchema>;
export type AuthVerifyCodeInput = z.infer<typeof authVerifyCodeSchema>;
export type AuthVerifyCodeResponse = z.infer<typeof authVerifyCodeResponseSchema>;
export type BilibiliParseRequest = z.infer<typeof bilibiliParseRequestSchema>;
export type BilibiliParseResponse = z.infer<typeof bilibiliParseResponseSchema>;
export type LocalAudioCacheRequest = z.infer<typeof localAudioCacheRequestSchema>;
export type LocalAudioCacheResponse = z.infer<typeof localAudioCacheResponseSchema>;
export type BilibiliFavoritePreviewRequest = z.infer<typeof bilibiliFavoritePreviewRequestSchema>;
export type BilibiliFavoritePreviewItem = z.infer<typeof bilibiliFavoritePreviewItemSchema>;
export type BilibiliFavoritePreviewResponse = z.infer<typeof bilibiliFavoritePreviewResponseSchema>;
