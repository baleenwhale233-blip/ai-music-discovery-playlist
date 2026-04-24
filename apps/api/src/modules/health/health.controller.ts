import { Controller, Get, Inject } from "@nestjs/common";
import type { HealthResponse } from "@ai-music-playlist/api-contract";

import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {
    this.getHealth = this.getHealth.bind(this);
  }

  @Get()
  getHealth(): HealthResponse {
    return this.healthService.getStatus();
  }
}
