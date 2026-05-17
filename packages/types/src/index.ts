export type SourcePlatform = "bilibili" | "youtube" | "douyin" | "tiktok";
export type SourceCollectionType = "favorites" | "playlist" | "medialist" | "manual";
export type PlaylistKind = "music" | "learning" | "mixed";
export type PlaylistSourceType = "manual" | "imported_collection" | "editorial";
export type VerificationTaskStatus =
  | "created"
  | "pending_user_action"
  | "pending_check"
  | "verified"
  | "rejected"
  | "expired"
  | "disputed";
export type PlaybackState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "buffering"
  | "ended"
  | "error"
  | "blocked_by_autoplay";
export type QueueState = "empty" | "prepared" | "active" | "advancing" | "finished";
export type PlaybackMode = "sequential" | "repeat-one" | "repeat-all" | "shuffle";
export type SourceContentKind = "music_video" | "short_video" | "talk_video" | "unknown";
export type PlaybackAvailability = "playable" | "blocked" | "unknown";
export type ImportStatus = "pending" | "ready" | "failed";
export type PlaylistVisibility = "private" | "public";
export type LocalAudioAssetStatus = "pending" | "caching" | "ready" | "failed" | "deleted";
export type LocalAudioStorageType = "self_hosted_node" | "cloud_temp" | "user_device";
export type ConversionTaskType =
  | "cache_audio"
  | "delete_audio"
  | "refresh_metadata"
  | "import_collection";
export type ConversionTaskStatus =
  | "created"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";
export type ConversionRunnerType = "self_hosted_node" | "cloud_node" | "unknown";

export interface User {
  id: string;
  phoneOrEmail: string;
  nickname: string;
  avatarUrl?: string | null;
  status: "active" | "disabled";
}

export interface SourceAccount {
  id: string;
  platform: SourcePlatform;
  platformAccountId: string;
  platformUniqueHandle?: string | null;
  displayName: string;
  profileUrl?: string | null;
  avatarUrl?: string | null;
  verificationStatus: VerificationTaskStatus;
}

export interface SourceContent {
  id: string;
  platform: SourcePlatform;
  platformContentId: string;
  canonicalUrl: string;
  title: string;
  coverUrl?: string | null;
  authorNameSnapshot?: string | null;
  sourceAccountId?: string | null;
  contentKind: SourceContentKind;
  durationSec?: number | null;
  publishTime?: string | null;
  playableStatus: PlaybackAvailability;
  importStatus: ImportStatus;
  rawPayloadJson?: unknown;
}

export interface SourceCollection {
  id: string;
  userId: string;
  platform: SourcePlatform;
  collectionType: SourceCollectionType;
  platformCollectionId: string;
  sourceUrl: string;
  title?: string | null;
  coverUrl?: string | null;
  ownerNameSnapshot?: string | null;
  itemCountSnapshot?: number | null;
  lastSyncedAt?: string | null;
}

export interface SourceCollectionItem {
  id: string;
  sourceCollectionId: string;
  sourceContentId: string;
  position: number;
  isExcluded: boolean;
  exclusionReason?: string | null;
}

export interface Playlist {
  id: string;
  userId: string;
  name: string;
  coverUrl?: string | null;
  description?: string | null;
  visibility: PlaylistVisibility;
  kind: PlaylistKind;
  sourceType: PlaylistSourceType;
  sourceCollectionId?: string | null;
  itemCount?: number | null;
  cachedItemCount?: number | null;
  isEditorial: boolean;
}

export interface PlaylistFavorite {
  id: string;
  userId: string;
  playlistId: string;
  createdAt: string;
}

export interface PlaylistItem {
  id: string;
  playlistId: string;
  sourceContentId: string;
  localAudioAssetId?: string | null;
  position: number;
  titleSnapshot?: string | null;
  coverUrlSnapshot?: string | null;
  durationSecSnapshot?: number | null;
}

export interface Favorite {
  id: string;
  userId: string;
  contentId: string;
}

export interface PlayHistory {
  id: string;
  userId: string;
  contentId: string;
  localAudioAssetId?: string | null;
  playlistId?: string | null;
  completionRatio?: number | null;
  endReason?: string | null;
}

export interface ContentMeta {
  id: string;
  contentId: string;
  styleTags: string[];
  moodTags: string[];
  contentType: "ai-original" | "ai-cover" | "style-remix" | "unknown";
  modelName?: string | null;
  shortNote?: string | null;
}

export interface LocalAudioAsset {
  id: string;
  userId: string;
  sourceContentId: string;
  cacheKey: string;
  storageType: LocalAudioStorageType;
  relativeFilePath?: string | null;
  coverRelativePath?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  durationSec?: number | null;
  status: LocalAudioAssetStatus;
  lastError?: string | null;
  lastAccessedAt?: string | null;
  deletedAt?: string | null;
}

export interface ConversionTask {
  id: string;
  userId: string;
  sourceContentId?: string | null;
  sourceCollectionId?: string | null;
  localAudioAssetId?: string | null;
  taskType: ConversionTaskType;
  status: ConversionTaskStatus;
  runnerType: ConversionRunnerType;
  runnerLabel?: string | null;
  attempts: number;
  priority: number;
  errorMessage?: string | null;
  payloadJson?: unknown;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface ClaimOrVerificationTask {
  id: string;
  userId: string;
  platform: SourcePlatform;
  verificationCode: string;
  verificationMethod: "dynamic-post" | "profile-bio";
  status: VerificationTaskStatus;
  expiresAt: string;
}

export const sourcePlatforms: SourcePlatform[] = ["bilibili", "youtube", "douyin", "tiktok"];
export const sourceCollectionTypes: SourceCollectionType[] = [
  "favorites",
  "playlist",
  "medialist",
  "manual"
];
export const playlistKinds: PlaylistKind[] = ["music", "learning", "mixed"];
export const localAudioAssetStatuses: LocalAudioAssetStatus[] = [
  "pending",
  "caching",
  "ready",
  "failed",
  "deleted"
];
export const conversionTaskStatuses: ConversionTaskStatus[] = [
  "created",
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled"
];
export const playbackStates: PlaybackState[] = [
  "idle",
  "loading",
  "ready",
  "playing",
  "paused",
  "buffering",
  "ended",
  "error",
  "blocked_by_autoplay"
];
