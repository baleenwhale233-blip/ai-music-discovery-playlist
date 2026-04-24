import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { getCachePaths, writeMetadata } from "./core.mjs";
import { createCleanRoomServer } from "./server.mjs";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve(server.address());
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error?.code === "ERR_SERVER_NOT_RUNNING") {
        resolve();
        return;
      }

      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

test("serves the clean-room page and health endpoint", async () => {
  const cacheRoot = join(tmpdir(), `local-audio-clean-room-server-${Date.now()}`);
  const server = createCleanRoomServer({ cacheRoot });

  try {
    const address = await listen(server);
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).name, "local-audio-clean-room");

    const page = await fetch(baseUrl);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Clean Room Experiment/);

    const playlist = await fetch(`${baseUrl}/api/playlist`);
    assert.equal(playlist.status, 200);
    assert.equal((await playlist.json()).playlist.itemCount, 0);
  } finally {
    await close(server);
    rmSync(cacheRoot, { recursive: true, force: true });
  }
});

test("renders bulk candidate controls for playlist curation", async () => {
  const cacheRoot = join(tmpdir(), `local-audio-clean-room-bulk-page-${Date.now()}`);
  const server = createCleanRoomServer({ cacheRoot });

  try {
    const address = await listen(server);
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const page = await fetch(baseUrl);
    const html = await page.text();

    assert.equal(page.status, 200);
    assert.match(html, /全选/);
    assert.match(html, /反选/);
    assert.match(html, /清空选择/);
    assert.match(html, /删除已选/);
    assert.match(html, /缓存已选/);
    assert.match(html, /candidate-check/);
    assert.match(html, /toggleCandidateSelected/);
  } finally {
    await close(server);
    rmSync(cacheRoot, { recursive: true, force: true });
  }
});


test("serves cached audio with HTTP Range support", async () => {
  const cacheRoot = join(tmpdir(), `local-audio-clean-room-range-${Date.now()}`);
  const paths = getCachePaths({ cacheRoot, cacheKey: "BVrange" });
  mkdirSync(paths.itemDir, { recursive: true });
  writeFileSync(paths.audioPath, Buffer.from("0123456789"));
  writeMetadata({
    metadataPath: paths.metadataPath,
    metadata: {
      cacheKey: "BVrange",
      sourceUrl: "https://www.bilibili.com/video/BVrange",
      normalizedUrl: "https://www.bilibili.com/video/BVrange?p=1",
      title: "Range Test",
      bvid: "BVrange",
      coverUrl: null,
      durationSeconds: 10,
      createdAt: "2026-04-24T00:00:00.000Z"
    }
  });

  const server = createCleanRoomServer({ cacheRoot });

  try {
    const address = await listen(server);
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/api/audio/BVrange`, {
      headers: {
        range: "bytes=2-5"
      }
    });

    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-range"), "bytes 2-5/10");
    assert.equal(await response.text(), "2345");
  } finally {
    await close(server);
    rmSync(cacheRoot, { recursive: true, force: true });
  }
});

test("serves cached covers through a same-origin proxy", async () => {
  const cacheRoot = join(tmpdir(), `local-audio-clean-room-cover-${Date.now()}`);
  const paths = getCachePaths({ cacheRoot, cacheKey: "BVcover" });
  mkdirSync(paths.itemDir, { recursive: true });
  writeFileSync(paths.audioPath, Buffer.from("fake audio"));
  writeMetadata({
    metadataPath: paths.metadataPath,
    metadata: {
      cacheKey: "BVcover",
      sourceUrl: "https://www.bilibili.com/video/BVcover",
      normalizedUrl: "https://www.bilibili.com/video/BVcover?p=1",
      title: "Cover Test",
      bvid: "BVcover",
      coverUrl: "https://i0.hdslb.com/bfs/archive/cover.jpg",
      durationSeconds: 10,
      createdAt: "2026-04-24T00:00:00.000Z"
    }
  });
  const fetchImpl = async (url) => {
    assert.equal(url, "https://i0.hdslb.com/bfs/archive/cover.jpg");
    return new Response(Buffer.from("cover-bytes"), {
      status: 200,
      headers: {
        "content-type": "image/jpeg"
      }
    });
  };
  const server = createCleanRoomServer({ cacheRoot, fetchImpl });

  try {
    const address = await listen(server);
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/api/cover/BVcover`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/jpeg");
    assert.equal(await response.text(), "cover-bytes");
  } finally {
    await close(server);
    rmSync(cacheRoot, { recursive: true, force: true });
  }
});

test("serves preview covers through a restricted remote cover proxy", async () => {
  const cacheRoot = join(tmpdir(), `local-audio-clean-room-remote-cover-${Date.now()}`);
  const fetchImpl = async (url) => {
    assert.equal(url, "https://i2.hdslb.com/bfs/archive/preview.jpg");
    return new Response(Buffer.from("preview-cover"), {
      status: 200,
      headers: {
        "content-type": "image/jpeg"
      }
    });
  };
  const server = createCleanRoomServer({ cacheRoot, fetchImpl });

  try {
    const address = await listen(server);
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/api/cover-proxy?url=${encodeURIComponent("https://i2.hdslb.com/bfs/archive/preview.jpg")}`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/jpeg");
    assert.equal(await response.text(), "preview-cover");

    const rejected = await fetch(`${baseUrl}/api/cover-proxy?url=${encodeURIComponent("https://example.com/not-bili.jpg")}`);
    assert.equal(rejected.status, 400);
  } finally {
    await close(server);
    rmSync(cacheRoot, { recursive: true, force: true });
  }
});
