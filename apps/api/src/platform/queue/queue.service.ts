import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

import { appEnv } from "../../config/env";

function getRedisConnection() {
  const url = new URL(appEnv.REDIS_URL);

  return {
    host: url.hostname,
    port: Number(url.port || 6379)
  };
}

@Injectable()
export class QueueService {
  private readonly queues = new Map<"imports" | "verification", Queue>();

  getQueue(name: "imports" | "verification") {
    const existing = this.queues.get(name);

    if (existing) {
      return existing;
    }

    const queue = new Queue(name, {
      connection: getRedisConnection()
    });

    this.queues.set(name, queue);

    return queue;
  }

  getRegisteredQueueNames() {
    return [...this.queues.keys()];
  }
}
