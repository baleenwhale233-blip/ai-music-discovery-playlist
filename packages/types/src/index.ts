export type SourcePlatform = "bilibili" | "douyin";

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
  durationSec?: number | null;
  publishTime?: string | null;
  playableStatus: "playable" | "blocked" | "unknown";
  importStatus: "pending" | "ready" | "failed";
}

export interface Playlist {
  id: string;
  userId: string;
  name: string;
  coverUrl?: string | null;
  description?: string | null;
  visibility: "private" | "public";
  isEditorial: boolean;
}

export interface PlaylistItem {
  id: string;
  playlistId: string;
  contentId: string;
  position: number;
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

export interface ClaimOrVerificationTask {
  id: string;
  userId: string;
  platform: SourcePlatform;
  verificationCode: string;
  verificationMethod: "dynamic-post" | "profile-bio";
  status: VerificationTaskStatus;
  expiresAt: string;
}

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
