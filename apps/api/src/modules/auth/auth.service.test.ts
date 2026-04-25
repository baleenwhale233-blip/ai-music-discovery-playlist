import { describe, expect, it } from "vitest";

import { AuthService } from "./auth.service";

describe("AuthService", () => {
  it("returns unauthorized for invalid alpha login input", async () => {
    const service = new AuthService({
      user: {
        upsert: async () => {
          throw new Error("should not reach database");
        }
      }
    } as never);

    await expect(
      service.verifyCode({
        phoneOrEmail: "test@example.com",
        inviteCode: "wrong",
        code: "000000",
        scenario: "login"
      }),
    ).rejects.toMatchObject({
      status: 401,
      message: "Invalid alpha invite code"
    });
  });

  it("returns service unavailable when the database is unreachable", async () => {
    const service = new AuthService({
      user: {
        upsert: async () => {
          throw new Error("Can't reach database server at localhost:5432");
        }
      }
    } as never);

    await expect(
      service.verifyCode({
        phoneOrEmail: "test@example.com",
        inviteCode: "alpha-50",
        code: "246810",
        scenario: "login"
      }),
    ).rejects.toMatchObject({
      status: 503,
      message: "Database is unavailable. Start local Postgres before logging in."
    });
  });
});
