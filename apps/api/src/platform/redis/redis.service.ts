import { Injectable } from "@nestjs/common";
import Redis from "ioredis";

import { appEnv } from "../../config/env";

@Injectable()
export class RedisService {
  private readonly client = new Redis(appEnv.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null
  });

  getClient() {
    return this.client;
  }
}
