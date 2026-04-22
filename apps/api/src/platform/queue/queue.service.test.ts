import { describe, expect, it } from "vitest";

import { QueueService } from "./queue.service";

describe("QueueService", () => {
  it("creates queues lazily so api startup does not require redis", () => {
    const service = new QueueService();

    expect(service.getRegisteredQueueNames()).toEqual([]);

    const importsQueue = service.getQueue("imports");

    expect(importsQueue.name).toBe("imports");
    expect(service.getRegisteredQueueNames()).toEqual(["imports"]);
  });

  it("reuses the same queue instance for repeated reads", () => {
    const service = new QueueService();

    const first = service.getQueue("verification");
    const second = service.getQueue("verification");

    expect(first).toBe(second);
    expect(service.getRegisteredQueueNames()).toEqual(["verification"]);
  });
});
