import { BadRequestException, Injectable } from "@nestjs/common";
import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";

import {
  BILIBILI_MOBILE_USER_AGENT,
  parseBilibiliMobileHtml5Playback
} from "./local-audio-cache";

@Injectable()
export class LocalAudioConversionService {
  assertExecutableAvailable(command: string) {
    for (const candidate of [`/opt/homebrew/bin/${command}`, `/usr/local/bin/${command}`]) {
      try {
        accessSync(candidate, constants.X_OK);
        return;
      } catch {
        // Keep checking common locations and PATH.
      }
    }

    const check = spawnSync(command, ["--version"], {
      stdio: "ignore"
    });

    if (check.status !== 0) {
      throw new BadRequestException(
        `${command} is required for this local audio experiment. Install it with: brew install yt-dlp ffmpeg`,
      );
    }
  }

  async fetchBilibiliMobilePlayableUrl(input: { bvid: string; page: number }) {
    const response = await fetch(`https://m.bilibili.com/video/${input.bvid}?p=${input.page}`, {
      headers: {
        "user-agent": BILIBILI_MOBILE_USER_AGENT,
        referer: "https://m.bilibili.com/"
      }
    });

    if (!response.ok) {
      throw new BadRequestException(`Bilibili mobile page request failed with ${response.status}`);
    }

    const html = await response.text();

    try {
      return parseBilibiliMobileHtml5Playback({ html }).playUrl;
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Unable to resolve bilibili mobile play url",
      );
    }
  }

  runFfmpeg(args: string[]) {
    return new Promise<void>((resolve, reject) => {
      const child = spawn("ffmpeg", args, {
        stdio: ["ignore", "pipe", "pipe"]
      });
      const stderr: string[] = [];

      child.stderr.on("data", (chunk: Buffer) => {
        stderr.push(chunk.toString("utf8"));
      });
      child.on("error", (error) => reject(error));
      child.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new BadRequestException(stderr.join("").trim() || `ffmpeg exited with ${code}`));
      });
    });
  }
}
