import { describe, expect, it } from "vitest";

import {
  authRequestCodeSchema,
  authVerifyCodeResponseSchema,
  modulePrefixes
} from "./index";

describe("api-contract package", () => {
  it("validates auth request payloads", () => {
    const parsed = authRequestCodeSchema.parse({
      phoneNumber: "13800000000",
      scenario: "login"
    });

    expect(parsed.phoneNumber).toBe("13800000000");
  });

  it("keeps the auth response contract", () => {
    const parsed = authVerifyCodeResponseSchema.parse({
      accessToken: "token",
      refreshToken: "refresh",
      expiresIn: 3600
    });

    expect(parsed.expiresIn).toBe(3600);
    expect(modulePrefixes.auth).toBe("auth");
  });
});
