import { Injectable } from "@nestjs/common";

import { appEnv } from "../../config/env";

@Injectable()
export class HealthService {
  getStatus() {
    return {
      name: "@ai-music-playlist/api",
      version: "0.1.0",
      prefix: appEnv.API_PREFIX,
      timestamp: new Date().toISOString()
    };
  }
}
