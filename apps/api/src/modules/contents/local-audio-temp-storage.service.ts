import { Injectable } from "@nestjs/common";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

import { LocalAudioPathService } from "./local-audio-path.service";

@Injectable()
export class LocalAudioTempStorageService {
  constructor(private readonly paths: LocalAudioPathService) {}

  async createTaskDir(taskId: string) {
    const taskDir = this.paths.getTaskTempDir(taskId);
    await mkdir(taskDir, { recursive: true });
    return {
      taskDir,
      sourcePath: this.paths.getTaskSourcePath(taskId),
      outputPath: this.paths.getTaskOutputPath(taskId)
    };
  }

  async removeTaskDir(taskId: string) {
    const taskDir = this.paths.getTaskTempDir(taskId);

    if (!this.paths.isInsideTempRoot(taskDir)) {
      throw new Error("Refusing to delete temp path outside configured root");
    }

    await rm(taskDir, { recursive: true, force: true });
  }

  async cleanupStaleTempDirs(olderThan: Date) {
    let deleted = 0;

    try {
      const entries = await readdir(this.paths.tempRoot, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const dir = join(this.paths.tempRoot, entry.name);

        if (!this.paths.isInsideTempRoot(dir)) {
          continue;
        }

        const stats = await stat(dir);

        if (stats.mtime < olderThan) {
          await rm(dir, { recursive: true, force: true });
          deleted += 1;
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    return deleted;
  }
}
