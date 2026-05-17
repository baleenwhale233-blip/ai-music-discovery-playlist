import { Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { HttpExceptionFilter } from "./http-exception.filter";

describe("HttpExceptionFilter", () => {
  it("returns 400 for zod validation errors instead of leaking them as 500s", () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const response = {
      status: vi.fn(() => response),
      json: vi.fn()
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({
          method: "POST",
          url: "/api/v1/local-audio/cache-requests"
        })
      })
    };
    const error = z.object({ sourceContentId: z.string().min(1) }).safeParse({ sourceContentId: "" });

    if (error.success) {
      throw new Error("Expected zod parse to fail");
    }

    new HttpExceptionFilter().catch(error.error, host as never);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
      message: "Invalid request body",
      issues: [expect.objectContaining({ path: "sourceContentId" })]
    }));
    expect(warn).toHaveBeenCalledWith("POST /api/v1/local-audio/cache-requests -> 400 Invalid request body");
    warn.mockRestore();
  });
});
