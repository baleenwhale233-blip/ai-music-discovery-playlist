import { describe, expect, it } from "vitest";

import { redactSensitiveUrl } from "./redact-sensitive-url";

describe("redactSensitiveUrl", () => {
  it("redacts access tokens from request URLs without removing safe query params", () => {
    expect(redactSensitiveUrl("/api/v1/local-audio/cache-1/audio?access_token=secret-token&range=1")).toBe(
      "/api/v1/local-audio/cache-1/audio?access_token=%5Bredacted%5D&range=1",
    );
  });

  it("redacts repeated access tokens from absolute URLs", () => {
    expect(
      redactSensitiveUrl(
        "http://127.0.0.1:4000/api/v1/local-audio/cache-1/cover?access_token=one&access_token=two",
      ),
    ).toBe(
      "http://127.0.0.1:4000/api/v1/local-audio/cache-1/cover?access_token=%5Bredacted%5D&access_token=%5Bredacted%5D",
    );
  });
});
