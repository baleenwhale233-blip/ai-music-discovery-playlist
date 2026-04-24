import { describe, expect, it } from "vitest";

import {
  normalizeAlphaIdentifier,
  signAlphaAccessToken,
  verifyAlphaAccessToken,
  validateAlphaLoginInput
} from "./alpha-auth";

describe("alpha auth helpers", () => {
  it("normalizes phone or email identifiers for user isolation", () => {
    expect(normalizeAlphaIdentifier("  Test.User@Example.COM ")).toBe("test.user@example.com");
    expect(normalizeAlphaIdentifier(" 13800000000 ")).toBe("13800000000");
  });

  it("validates invite-gated alpha login input", () => {
    expect(
      validateAlphaLoginInput(
        {
          phoneOrEmail: "test@example.com",
          code: "246810",
          inviteCode: "alpha-50"
        },
        {
          alphaLoginCode: "246810",
          alphaInviteCode: "alpha-50"
        },
      ),
    ).toEqual({
      phoneOrEmail: "test@example.com"
    });
  });

  it("rejects invalid alpha invite or login codes", () => {
    expect(() =>
      validateAlphaLoginInput(
        {
          phoneOrEmail: "test@example.com",
          code: "000000",
          inviteCode: "wrong"
        },
        {
          alphaLoginCode: "246810",
          alphaInviteCode: "alpha-50"
        },
      ),
    ).toThrow("Invalid alpha invite code");
  });

  it("signs and verifies an HMAC access token", () => {
    const token = signAlphaAccessToken({
      secret: "unit-test-secret",
      userId: "user-1",
      phoneOrEmail: "test@example.com",
      expiresInSeconds: 3600,
      nowMs: Date.UTC(2026, 3, 24)
    });

    expect(
      verifyAlphaAccessToken({
        token,
        secret: "unit-test-secret",
        nowMs: Date.UTC(2026, 3, 24) + 1000
      }),
    ).toMatchObject({
      userId: "user-1",
      phoneOrEmail: "test@example.com"
    });
  });
});
