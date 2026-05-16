import { Injectable, Optional } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { isAbsolute, join, relative, resolve } from "node:path";

import { appEnv } from "../../config/env";
import { toSafeCacheKey } from "./local-audio-cache";

export type LocalAudioPathConfig = {
  tempRoot: string;
  stagingRoot: string;
  cacheRoot: string;
};

@Injectable()
export class LocalAudioPathService {
  readonly tempRoot: string;
  readonly stagingRoot: string;
  readonly cacheRoot: string;

  constructor(@Optional() config?: LocalAudioPathConfig) {
    const resolvedConfig = config ?? {
      tempRoot: appEnv.LOCAL_AUDIO_TEMP_ROOT,
      stagingRoot: appEnv.LOCAL_AUDIO_STAGING_ROOT,
      cacheRoot: appEnv.LOCAL_AUDIO_CACHE_ROOT
    };
    this.tempRoot = resolve(resolvedConfig.tempRoot);
    this.stagingRoot = resolve(resolvedConfig.stagingRoot);
    this.cacheRoot = resolve(resolvedConfig.cacheRoot);
  }

  getTaskTempDir(taskId: string) {
    return this.resolveInsideRoot(this.tempRoot, toSafeCacheKey(taskId));
  }

  getTaskSourcePath(taskId: string) {
    return join(this.getTaskTempDir(taskId), "source.media");
  }

  getTaskOutputPath(taskId: string, extension = ".m4a") {
    return join(this.getTaskTempDir(taskId), `output${this.normalizeExtension(extension)}`);
  }

  getStagingArtifactPath(assetId: string, extension = ".m4a") {
    const safeAssetId = toSafeCacheKey(assetId);
    const artifactId = randomUUID();
    return this.resolveInsideRoot(this.stagingRoot, safeAssetId, `${artifactId}${this.normalizeExtension(extension)}`);
  }

  toStagingRelativePath(absolutePath: string) {
    return this.relativeInsideRoot(this.stagingRoot, absolutePath);
  }

  resolveStagingRelativePath(relativePath: string) {
    return this.resolveInsideRoot(this.stagingRoot, relativePath);
  }

  isInsideTempRoot(candidatePath: string) {
    return isPathInsideRoot(this.tempRoot, candidatePath);
  }

  isInsideStagingRoot(candidatePath: string) {
    return isPathInsideRoot(this.stagingRoot, candidatePath);
  }

  private normalizeExtension(extension: string) {
    const normalized = extension.startsWith(".") ? extension : `.${extension}`;

    if (!/^\.[0-9A-Za-z]+$/.test(normalized)) {
      throw new Error("Invalid audio artifact extension");
    }

    return normalized.toLowerCase();
  }

  private resolveInsideRoot(root: string, ...parts: string[]) {
    const candidate = resolve(root, ...parts);

    if (!isPathInsideRoot(root, candidate)) {
      throw new Error("Resolved local audio path escapes configured root");
    }

    return candidate;
  }

  private relativeInsideRoot(root: string, candidatePath: string) {
    if (!isPathInsideRoot(root, candidatePath)) {
      throw new Error("Local audio path escapes configured root");
    }

    return relative(root, resolve(candidatePath));
  }
}

export function isPathInsideRoot(rootPath: string, candidatePath: string) {
  const root = resolve(rootPath);
  const candidate = resolve(candidatePath);
  const relativePath = relative(root, candidate);

  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}
