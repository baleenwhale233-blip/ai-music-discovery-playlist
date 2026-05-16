import { Injectable } from "@nestjs/common";
import { createReadStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname, extname } from "node:path";

import { LocalAudioPathService } from "./local-audio-path.service";

@Injectable()
export class LocalAudioStagingStorageService {
  constructor(private readonly paths: LocalAudioPathService) {}

  async stageArtifact(input: { assetId: string; sourcePath: string; extension?: string }) {
    const extension = input.extension ?? (extname(input.sourcePath) || ".m4a");
    const absolutePath = this.paths.getStagingArtifactPath(input.assetId, extension);
    await mkdir(dirname(absolutePath), { recursive: true });
    await rename(input.sourcePath, absolutePath);

    return {
      absolutePath,
      relativePath: this.paths.toStagingRelativePath(absolutePath)
    };
  }

  resolveRelativePath(relativePath: string) {
    return this.paths.resolveStagingRelativePath(relativePath);
  }

  async deleteRelativePath(relativePath: string | null | undefined) {
    if (!relativePath) {
      return false;
    }

    const absolutePath = this.resolveRelativePath(relativePath);

    if (!this.paths.isInsideStagingRoot(absolutePath)) {
      throw new Error("Refusing to delete staging path outside configured root");
    }

    await rm(absolutePath, { force: true });
    return true;
  }

  async openReadStream(relativePath: string) {
    const absolutePath = this.resolveRelativePath(relativePath);
    const stats = await stat(absolutePath);

    return {
      absolutePath,
      stream: createReadStream(absolutePath),
      totalSize: stats.size
    };
  }

  createReadStream(relativePath: string, range?: { start: number; end: number }) {
    const absolutePath = this.resolveRelativePath(relativePath);
    return createReadStream(absolutePath, range);
  }
}
