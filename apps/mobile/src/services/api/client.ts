import type { HealthResponse } from "@ai-music-playlist/api-contract";

import { apiConfig } from "./config";

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${apiConfig.baseUrl}/health`);

  if (!response.ok) {
    throw new Error(`Health request failed with ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}
