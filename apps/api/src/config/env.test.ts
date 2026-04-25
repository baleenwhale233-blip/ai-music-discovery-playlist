import { describe, expect, it } from "vitest";

import {
  assertProductionSafeEnv,
  parseAllowedCorsOrigins,
  parseBooleanEnvFlag
} from "./env";

describe("api env helpers", () => {
  it("parses comma-separated CORS origins", () => {
    expect(parseAllowedCorsOrigins("https://app.example.com, http://localhost:3020 ,,")).toEqual([
      "https://app.example.com",
      "http://localhost:3020"
    ]);
  });

  it("parses optional boolean flags with a default", () => {
    expect(parseBooleanEnvFlag(undefined, true)).toBe(true);
    expect(parseBooleanEnvFlag("false", true)).toBe(false);
    expect(parseBooleanEnvFlag("1", false)).toBe(true);
  });

  it("rejects dangerous production defaults", () => {
    expect(() =>
      assertProductionSafeEnv({
        NODE_ENV: "production",
        JWT_SECRET: "change-me",
        ALPHA_LOGIN_CODE: "246810",
        ALPHA_INVITE_CODE: "alpha-50",
        CORS_ALLOWED_ORIGINS: []
      }),
    ).toThrow("Unsafe production configuration");
  });
});
