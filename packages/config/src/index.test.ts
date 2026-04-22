import { describe, expect, it } from "vitest";

import { apiEnvSchema, workspaceMetadata } from "./index";

describe("config package", () => {
  it("provides defaults for the api env schema", () => {
    const parsed = apiEnvSchema.parse({});

    expect(parsed.PORT).toBe(4000);
    expect(parsed.API_PREFIX).toBe("api/v1");
  });

  it("exposes workspace metadata", () => {
    expect(workspaceMetadata.packageScope).toBe("@ai-music-playlist");
  });
});
