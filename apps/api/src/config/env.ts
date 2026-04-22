import { z } from "zod";

const apiEnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default("api/v1"),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/ai_music_playlist"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().default("change-me"),
  SMS_PROVIDER: z.string().default("placeholder")
});

export const appEnv = apiEnvSchema.parse(process.env);
