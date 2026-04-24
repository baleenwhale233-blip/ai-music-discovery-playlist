import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { createCleanRoomServer } from "./server.mjs";
import { getCachePaths, writeMetadata } from "./core.mjs";

const HOST = "127.0.0.1";

function log(message) {
  process.stdout.write(`${message}\n`);
}

function run(command, args) {
  log(`\n$ ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Command failed with exit ${result.status}`);
  }
}

function listen(server) {
  return new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, HOST, () => resolvePromise(server.address()));
  });
}

function close(server) {
  return new Promise((resolvePromise, reject) => {
    server.close((error) => {
      if (error?.code === "ERR_SERVER_NOT_RUNNING") {
        resolvePromise();
        return;
      }

      if (error) {
        reject(error);
        return;
      }

      resolvePromise();
    });
  });
}

async function expectJson(url, check) {
  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  check(payload);
}

async function expectText(url, pattern) {
  const response = await fetch(url);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  if (!pattern.test(text)) {
    throw new Error(`${url} did not match ${pattern}`);
  }
}

async function main() {
  log(`Node: ${process.version}`);
  log(`Node binary: ${process.execPath}`);

  if (!process.version.startsWith("v22.")) {
    log("Warning: verification is intended for Node 22 LTS.");
  }

  run(process.execPath, ["--test", "experiments/local-audio-clean-room/*.test.mjs"]);

  const cacheRoot = join(tmpdir(), `local-audio-clean-room-verify-${Date.now()}`);
  const server = createCleanRoomServer({ cacheRoot });

  try {
    const address = await listen(server);
    const baseUrl = `http://${HOST}:${address.port}`;

    log(`\nStarted smoke server: ${baseUrl}`);

    await expectJson(`${baseUrl}/health`, (payload) => {
      if (payload.name !== "local-audio-clean-room" || payload.ok !== true) {
        throw new Error("Health response is invalid");
      }
    });
    log("✓ health");

    await expectText(baseUrl, /Clean Room Experiment/);
    log("✓ page");

    await expectJson(`${baseUrl}/api/playlist`, (payload) => {
      if (payload.playlist.itemCount !== 0 || payload.items.length !== 0) {
        throw new Error("Empty playlist response is invalid");
      }
    });
    log("✓ empty playlist");

    const paths = getCachePaths({ cacheRoot, cacheKey: "BVverify" });
    mkdirSync(paths.itemDir, { recursive: true });
    writeFileSync(paths.audioPath, Buffer.from("0123456789"));
    writeMetadata({
      metadataPath: paths.metadataPath,
      metadata: {
        cacheKey: "BVverify",
        sourceUrl: "https://www.bilibili.com/video/BVverify",
        normalizedUrl: "https://www.bilibili.com/video/BVverify?p=1",
        title: "Verify Range",
        bvid: "BVverify",
        coverUrl: null,
        durationSeconds: 10,
        createdAt: new Date().toISOString()
      }
    });

    const rangeResponse = await fetch(`${baseUrl}/api/audio/BVverify`, {
      headers: {
        range: "bytes=2-5"
      }
    });

    if (rangeResponse.status !== 206) {
      throw new Error(`Range request returned ${rangeResponse.status}`);
    }

    if (rangeResponse.headers.get("content-range") !== "bytes 2-5/10") {
      throw new Error("Range response has invalid Content-Range");
    }

    if ((await rangeResponse.text()) !== "2345") {
      throw new Error("Range response body is invalid");
    }

    log("✓ audio range 206");
    log("\nVerification complete. Manual URL: http://127.0.0.1:3010");
  } finally {
    await close(server);
    rmSync(cacheRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
