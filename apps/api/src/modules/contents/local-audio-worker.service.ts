import { BadRequestException, Inject, Injectable, Optional } from "@nestjs/common";
import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

import { appEnv } from "../../config/env";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { parseBilibiliLink } from "./bilibili-link.parser";
import { BILIBILI_DESKTOP_USER_AGENT } from "./local-audio-cache";
import { FileHashService } from "./local-audio-file-hash.service";
import { LocalAudioStagingStorageService } from "./local-audio-staging-storage.service";
import { LocalAudioTempStorageService } from "./local-audio-temp-storage.service";

export type SourceMediaDownloader = {
  download(input: {
    sourceUrl: string;
    outputPath: string;
    maxSourceBytes: number;
    maxDurationSec: number;
  }): Promise<{ sourcePath: string }>;
};

export type AudioConverter = {
  convert(input: {
    sourcePath: string;
    outputPath: string;
    maxOutputBytes: number;
    maxDurationSec: number;
  }): Promise<{ outputPath: string; mimeType: string; durationSec: number | null }>;
};

type PrismaWorkerClient = {
  sourceContent: {
    findUnique(input: { where: { id: string } }): Promise<{
      id: string;
      canonicalUrl: string;
      platform: string;
      platformContentId: string;
      durationSec: number | null;
    } | null>;
  };
  localAudioAsset: {
    update(input: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
  conversionTask: {
    findFirst(input: { where: { id: string } }): Promise<{
      id: string;
      userId: string;
      sourceContentId: string | null;
      localAudioAssetId: string | null;
    } | null>;
    update(input: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
    updateMany(input: {
      where: { id: string; status: { in: string[] } };
      data: Record<string, unknown>;
    }): Promise<{ count: number }>;
  };
};

@Injectable()
export class YtDlpSourceMediaDownloader implements SourceMediaDownloader {
  async download(input: { sourceUrl: string; outputPath: string; maxSourceBytes: number; maxDurationSec: number }) {
    assertAllowedBilibiliUrl(input.sourceUrl);
    const outputTemplate = `${input.outputPath}.%(ext)s`;
    await runCommand(appEnv.YT_DLP_PATH, [
      "--no-playlist",
      "--no-cookies",
      "--referer",
      "https://www.bilibili.com/",
      "--user-agent",
      BILIBILI_DESKTOP_USER_AGENT,
      "--max-filesize",
      String(input.maxSourceBytes),
      "--output",
      outputTemplate,
      input.sourceUrl
    ]);

    const sourcePath = await findDownloadedSourcePath(input.outputPath);
    await assertFileWithinLimit(sourcePath, input.maxSourceBytes, "Downloaded source is too large");
    return { sourcePath };
  }
}

@Injectable()
export class FfmpegAudioConverter implements AudioConverter {
  async convert(input: { sourcePath: string; outputPath: string; maxOutputBytes: number; maxDurationSec: number }) {
    try {
      await runCommand(appEnv.FFMPEG_PATH, buildFfmpegRemuxArgs(input));
    } catch {
      await runCommand(appEnv.FFMPEG_PATH, buildFfmpegTranscodeArgs(input));
    }
    await assertFileWithinLimit(input.outputPath, input.maxOutputBytes, "Converted audio is too large");

    return {
      outputPath: input.outputPath,
      mimeType: "audio/mp4",
      durationSec: null
    };
  }
}

function buildFfmpegRemuxArgs(input: { sourcePath: string; outputPath: string; maxOutputBytes: number; maxDurationSec: number }) {
  return [
    "-y",
    "-t",
    String(input.maxDurationSec),
    "-i",
    input.sourcePath,
    "-vn",
    "-map",
    "0:a:0",
    "-c:a",
    "copy",
    "-movflags",
    "+faststart",
    "-fs",
    String(input.maxOutputBytes),
    input.outputPath
  ];
}

function buildFfmpegTranscodeArgs(input: { sourcePath: string; outputPath: string; maxOutputBytes: number; maxDurationSec: number }) {
  return [
    "-y",
    "-t",
    String(input.maxDurationSec),
    "-i",
    input.sourcePath,
    "-vn",
    "-map",
    "0:a:0",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    "-fs",
    String(input.maxOutputBytes),
    input.outputPath
  ];
}

@Injectable()
export class LocalAudioWorkerService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaWorkerClient,
    @Inject(LocalAudioTempStorageService)
    private readonly tempStorage: LocalAudioTempStorageService,
    @Inject(LocalAudioStagingStorageService)
    private readonly stagingStorage: LocalAudioStagingStorageService,
    @Inject(FileHashService)
    private readonly fileHash: FileHashService,
    @Inject("SourceMediaDownloader")
    private readonly downloader: SourceMediaDownloader,
    @Inject("AudioConverter")
    private readonly converter: AudioConverter,
    @Optional() options?: {
      stagingTtlHours: number;
      maxDurationSec?: number;
      maxSourceBytes?: number;
      maxOutputBytes?: number;
    },
  ) {
    this.options = options ?? {
      stagingTtlHours: appEnv.LOCAL_AUDIO_STAGING_TTL_HOURS,
      maxDurationSec: appEnv.LOCAL_AUDIO_MAX_DURATION_SEC,
      maxSourceBytes: appEnv.LOCAL_AUDIO_MAX_SOURCE_BYTES,
      maxOutputBytes: appEnv.LOCAL_AUDIO_MAX_OUTPUT_BYTES
    };
  }

  private readonly options: {
    stagingTtlHours: number;
    maxDurationSec?: number;
    maxSourceBytes?: number;
    maxOutputBytes?: number;
  };

  async runTask(taskId: string) {
    const task = await this.prisma.conversionTask.findFirst({ where: { id: taskId } });

    if (!task?.localAudioAssetId || !task.sourceContentId) {
      return;
    }

    const lock = await this.prisma.conversionTask.updateMany({
      where: {
        id: taskId,
        status: {
          in: ["CREATED", "QUEUED"]
        }
      },
      data: {
        status: "RUNNING",
        runnerType: "SELF_HOSTED_NODE",
        runnerLabel: "api-local-audio-worker",
        attempts: 1,
        startedAt: new Date(),
        errorMessage: null
      }
    });

    if (lock.count !== 1) {
      return;
    }

    await this.prisma.localAudioAsset.update({
      where: { id: task.localAudioAssetId },
      data: {
        status: "CACHING",
        lastError: null
      }
    });

    const temp = await this.tempStorage.createTaskDir(taskId);

    try {
      const sourceContent = await this.prisma.sourceContent.findUnique({
        where: { id: task.sourceContentId }
      });

      if (!sourceContent) {
        throw new BadRequestException("Source content not found");
      }

      if (sourceContent.platform !== "BILIBILI") {
        throw new BadRequestException("Only public Bilibili source content is supported for local audio caching");
      }

      const parsed = parseBilibiliLink(sourceContent.canonicalUrl);
      const downloaded = await this.downloader.download({
        sourceUrl: parsed.normalizedUrl,
        outputPath: temp.sourcePath,
        maxDurationSec: this.options.maxDurationSec ?? appEnv.LOCAL_AUDIO_MAX_DURATION_SEC,
        maxSourceBytes: this.options.maxSourceBytes ?? appEnv.LOCAL_AUDIO_MAX_SOURCE_BYTES
      });
      const converted = await this.converter.convert({
        sourcePath: downloaded.sourcePath,
        outputPath: temp.outputPath,
        maxDurationSec: this.options.maxDurationSec ?? appEnv.LOCAL_AUDIO_MAX_DURATION_SEC,
        maxOutputBytes: this.options.maxOutputBytes ?? appEnv.LOCAL_AUDIO_MAX_OUTPUT_BYTES
      });
      const staged = await this.stagingStorage.stageArtifact({
        assetId: task.localAudioAssetId,
        sourcePath: converted.outputPath,
        extension: extname(converted.outputPath) || ".m4a"
      });
      const stats = await stat(staged.absolutePath);
      const sha256 = await this.fileHash.sha256File(staged.absolutePath);
      const expiresAt = new Date(Date.now() + this.options.stagingTtlHours * 60 * 60 * 1000);

      await this.prisma.localAudioAsset.update({
        where: { id: task.localAudioAssetId },
        data: {
          status: "READY",
          storageType: "SELF_HOSTED_NODE",
          relativeFilePath: staged.relativePath,
          mimeType: converted.mimeType,
          fileSizeBytes: stats.size,
          durationSec: converted.durationSec ?? sourceContent.durationSec,
          sha256,
          serverArtifactExpiresAt: expiresAt,
          clientCachedAt: null,
          serverDeletedAt: null,
          clientStorageKind: null,
          clientStorageKey: null,
          lastError: null,
          deletedAt: null
        }
      });
      await this.prisma.conversionTask.update({
        where: { id: taskId },
        data: {
          status: "SUCCEEDED",
          finishedAt: new Date(),
          errorMessage: null
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Local audio conversion failed";
      await this.prisma.localAudioAsset.update({
        where: { id: task.localAudioAssetId },
        data: {
          status: "FAILED",
          lastError: message,
          relativeFilePath: null
        }
      });
      await this.prisma.conversionTask.update({
        where: { id: taskId },
        data: {
          status: "FAILED",
          errorMessage: message,
          finishedAt: new Date()
        }
      });
    } finally {
      await this.tempStorage.removeTaskDir(taskId);
    }
  }
}

function assertAllowedBilibiliUrl(sourceUrl: string) {
  const parsed = new URL(sourceUrl);
  const hostname = parsed.hostname.toLowerCase();
  const allowed =
    hostname === "bilibili.com" ||
    hostname.endsWith(".bilibili.com") ||
    hostname === "b23.tv" ||
    hostname === "bili2233.cn";

  if (parsed.protocol !== "https:" || !allowed) {
    throw new BadRequestException("Only public Bilibili HTTPS links are supported");
  }
}

async function assertFileWithinLimit(filePath: string, maxBytes: number, message: string) {
  const stats = await stat(filePath);

  if (stats.size > maxBytes) {
    throw new BadRequestException(message);
  }
}

async function findDownloadedSourcePath(outputPath: string) {
  try {
    await stat(outputPath);
    return outputPath;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const directory = dirname(outputPath);
  const prefix = `${basename(outputPath)}.`;
  const entries = await readdir(directory, { withFileTypes: true });
  const match = entries.find((entry) => entry.isFile() && entry.name.startsWith(prefix));

  if (!match) {
    throw new BadRequestException("Downloaded source file was not created");
  }

  return join(directory, match.name);
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "ignore", "pipe"]
    });
    const stderr: string[] = [];

    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new BadRequestException(stderr.join("").trim() || `${command} exited with ${code}`));
    });
  });
}
