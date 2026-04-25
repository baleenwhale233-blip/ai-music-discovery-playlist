import { z } from "zod";

const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default("api/v1"),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/ai_music_playlist"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().default("change-me"),
  SMS_PROVIDER: z.string().default("placeholder"),
  ALPHA_LOGIN_CODE: z.string().default("246810"),
  ALPHA_INVITE_CODE: z.string().default("alpha-50"),
  ACCESS_TOKEN_EXPIRES_IN_SECONDS: z.coerce.number().default(60 * 60 * 24 * 7),
  LOCAL_AUDIO_CACHE_DIR: z.string().default(".local-audio-cache"),
  CORS_ALLOWED_ORIGINS: z.string().default(""),
  ENABLE_EXPERIMENTAL_ROUTES: z.string().optional(),
  ENABLE_DEBUG_ROUTES: z.string().optional()
});

const DANGEROUS_PRODUCTION_VALUES = {
  JWT_SECRET: "change-me",
  ALPHA_LOGIN_CODE: "246810",
  ALPHA_INVITE_CODE: "alpha-50"
} as const;

export function parseAllowedCorsOrigins(input: string) {
  return input
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function parseBooleanEnvFlag(input: string | undefined, defaultValue: boolean) {
  if (input === undefined || input === "") {
    return defaultValue;
  }

  const normalized = input.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid boolean env flag: ${input}`);
}

export function assertProductionSafeEnv(input: {
  NODE_ENV: string;
  JWT_SECRET: string;
  ALPHA_LOGIN_CODE: string;
  ALPHA_INVITE_CODE: string;
  CORS_ALLOWED_ORIGINS: string[];
}) {
  if (input.NODE_ENV !== "production") {
    return;
  }

  const errors: string[] = [];

  for (const [key, dangerousValue] of Object.entries(DANGEROUS_PRODUCTION_VALUES)) {
    const value = input[key as keyof typeof DANGEROUS_PRODUCTION_VALUES];

    if (!value || value === dangerousValue) {
      errors.push(`${key} must be set to a non-default value`);
    }
  }

  if (input.CORS_ALLOWED_ORIGINS.length === 0) {
    errors.push("CORS_ALLOWED_ORIGINS must list at least one production origin");
  }

  if (errors.length > 0) {
    throw new Error(`Unsafe production configuration: ${errors.join("; ")}`);
  }
}

const rawAppEnv = apiEnvSchema.parse(process.env);
const isProduction = rawAppEnv.NODE_ENV === "production";

export const appEnv = {
  ...rawAppEnv,
  CORS_ALLOWED_ORIGINS: parseAllowedCorsOrigins(rawAppEnv.CORS_ALLOWED_ORIGINS),
  ENABLE_EXPERIMENTAL_ROUTES: parseBooleanEnvFlag(rawAppEnv.ENABLE_EXPERIMENTAL_ROUTES, !isProduction),
  ENABLE_DEBUG_ROUTES: parseBooleanEnvFlag(rawAppEnv.ENABLE_DEBUG_ROUTES, !isProduction)
};

assertProductionSafeEnv(appEnv);

// Prisma and other runtime dependencies read directly from process.env.
// Mirror validated defaults back into process.env so local experiments can boot
// even when app-specific .env files have not been created yet.
process.env.NODE_ENV ??= appEnv.NODE_ENV;
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
process.env.CORS_ALLOWED_ORIGINS ??= rawAppEnv.CORS_ALLOWED_ORIGINS;
process.env.ENABLE_EXPERIMENTAL_ROUTES ??= String(appEnv.ENABLE_EXPERIMENTAL_ROUTES);
process.env.ENABLE_DEBUG_ROUTES ??= String(appEnv.ENABLE_DEBUG_ROUTES);
