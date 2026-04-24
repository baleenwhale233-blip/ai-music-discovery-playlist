import { z } from "zod";

const apiEnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default("api/v1"),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/ai_music_playlist"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().default("change-me"),
  SMS_PROVIDER: z.string().default("placeholder"),
  ALPHA_LOGIN_CODE: z.string().default("246810"),
  ALPHA_INVITE_CODE: z.string().default("alpha-50"),
  ACCESS_TOKEN_EXPIRES_IN_SECONDS: z.coerce.number().default(60 * 60 * 24 * 7),
  LOCAL_AUDIO_CACHE_DIR: z.string().default(".local-audio-cache")
});

export const appEnv = apiEnvSchema.parse(process.env);

// Prisma and other runtime dependencies read directly from process.env.
// Mirror validated defaults back into process.env so local experiments can boot
// even when app-specific .env files have not been created yet.
process.env.PORT ??= String(appEnv.PORT);
process.env.API_PREFIX ??= appEnv.API_PREFIX;
process.env.DATABASE_URL ??= appEnv.DATABASE_URL;
process.env.REDIS_URL ??= appEnv.REDIS_URL;
process.env.JWT_SECRET ??= appEnv.JWT_SECRET;
process.env.SMS_PROVIDER ??= appEnv.SMS_PROVIDER;
process.env.ALPHA_LOGIN_CODE ??= appEnv.ALPHA_LOGIN_CODE;
process.env.ALPHA_INVITE_CODE ??= appEnv.ALPHA_INVITE_CODE;
process.env.ACCESS_TOKEN_EXPIRES_IN_SECONDS ??= String(appEnv.ACCESS_TOKEN_EXPIRES_IN_SECONDS);
process.env.LOCAL_AUDIO_CACHE_DIR ??= appEnv.LOCAL_AUDIO_CACHE_DIR;
