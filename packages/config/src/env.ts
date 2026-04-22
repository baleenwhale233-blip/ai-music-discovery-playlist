import { z } from "zod";

export const rootEnvSchema = z.object({
  TURBO_TELEMETRY_DISABLED: z.string().optional()
});

export const apiEnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default("api/v1"),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/ai_music_playlist"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().default("change-me"),
  SMS_PROVIDER: z.string().default("placeholder")
});

export const mobileEnvSchema = z.object({
  EXPO_PUBLIC_API_BASE_URL: z.string().default("http://localhost:4000/api/v1"),
  EXPO_PUBLIC_SENTRY_DSN: z.string().optional()
});

export const adminEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().default("http://localhost:4000/api/v1")
});

export type RootEnv = z.infer<typeof rootEnvSchema>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type MobileEnv = z.infer<typeof mobileEnvSchema>;
export type AdminEnv = z.infer<typeof adminEnvSchema>;
