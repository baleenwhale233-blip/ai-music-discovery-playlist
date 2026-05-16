import { Inject, Injectable, Optional } from "@nestjs/common";

import { appEnv } from "../../config/env";
import { LocalAudioWorkerService } from "./local-audio-worker.service";

@Injectable()
export class LocalAudioJobRunnerService {
  private readonly pending: string[] = [];
  private active = 0;

  constructor(
    @Inject(LocalAudioWorkerService)
    private readonly worker: LocalAudioWorkerService,
    @Optional() options?: { concurrency: number },
  ) {
    this.options = options ?? { concurrency: appEnv.LOCAL_AUDIO_WORKER_CONCURRENCY };
  }

  private readonly options: { concurrency: number };

  enqueue(taskId: string) {
    this.pending.push(taskId);
    this.drain();
  }

  private drain() {
    while (this.active < this.options.concurrency && this.pending.length > 0) {
      const taskId = this.pending.shift();

      if (!taskId) {
        continue;
      }

      this.active += 1;
      void this.worker.runTask(taskId).finally(() => {
        this.active -= 1;
        this.drain();
      });
    }
  }
}
