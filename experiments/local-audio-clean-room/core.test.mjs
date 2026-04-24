import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildPlaylistFromCache,
  fetchBilibiliFavoritePreview,
  getCachePaths,
  listCacheKeys,
  parseBilibiliFavoriteLink,
  parseBilibiliLink,
  parseBilibiliMobileHtml5Playback,
  parseHttpRange,
  readMetadata,
  writeMetadata
} from "./core.mjs";

test("parses Bilibili video links into a stable cache identity", () => {
  assert.deepEqual(
    parseBilibiliLink("https://m.bilibili.com/video/BV1B7411m7LV?p=2&share_source=copy_web"),
    {
      bvid: "BV1B7411m7LV",
      page: 2,
      normalizedUrl: "https://www.bilibili.com/video/BV1B7411m7LV?p=2"
    },
  );
});

test("parses supported Bilibili favorite and playlist links", () => {
  assert.deepEqual(parseBilibiliFavoriteLink("https://space.bilibili.com/123/favlist?fid=987654"), {
    mediaId: "987654"
  });
  assert.deepEqual(parseBilibiliFavoriteLink("https://www.bilibili.com/medialist/detail/ml778899"), {
    mediaId: "778899"
  });
  assert.deepEqual(parseBilibiliFavoriteLink("https://space.bilibili.com/123/lists/445566?type=season"), {
    mediaId: "445566"
  });
});

test("extracts a direct mobile playback URL from Bilibili initial state", () => {
  const html = `
    <script>
      window.__INITIAL_STATE__={"video":{"playUrlInfo":[{"url":"https://upos.example/audio.m4a"}],"viewInfo":{"cid":123,"title":"Demo Song","pic":"//i0.hdslb.com/demo.jpg"}}};
    </script>
  `;

  assert.deepEqual(parseBilibiliMobileHtml5Playback({ html }), {
    playUrl: "https://upos.example/audio.m4a",
    cid: 123,
    title: "Demo Song",
    coverUrl: "https://i0.hdslb.com/demo.jpg"
  });
});

test("parses valid HTTP byte ranges and rejects invalid ranges", () => {
  assert.deepEqual(parseHttpRange("bytes=10-19", 100), {
    start: 10,
    end: 19,
    chunkSize: 10,
    totalSize: 100,
    contentRange: "bytes 10-19/100"
  });
  assert.deepEqual(parseHttpRange("bytes=90-", 100), {
    start: 90,
    end: 99,
    chunkSize: 10,
    totalSize: 100,
    contentRange: "bytes 90-99/100"
  });
  assert.equal(parseHttpRange("items=0-1", 100), null);
  assert.equal(parseHttpRange("bytes=100-101", 100), null);
});

test("reads local metadata, lists cache keys, and builds a playlist", () => {
  const root = join(tmpdir(), `local-audio-clean-room-${Date.now()}`);

  try {
    for (const cacheKey of ["BV2demo", "BV1demo"]) {
      const paths = getCachePaths({ cacheRoot: root, cacheKey });
      mkdirSync(paths.itemDir, { recursive: true });
      writeFileSync(paths.audioPath, "fake audio");
      writeMetadata({
        metadataPath: paths.metadataPath,
        metadata: {
          cacheKey,
          sourceUrl: `https://www.bilibili.com/video/${cacheKey}`,
          normalizedUrl: `https://www.bilibili.com/video/${cacheKey}?p=1`,
          title: `Title ${cacheKey}`,
          bvid: cacheKey,
          coverUrl: "https://i0.hdslb.com/demo.jpg",
          durationSeconds: 42,
          createdAt: "2026-04-24T00:00:00.000Z"
        }
      });
    }

    assert.deepEqual(listCacheKeys(root), ["BV1demo", "BV2demo"]);
    assert.equal(readMetadata(getCachePaths({ cacheRoot: root, cacheKey: "BV1demo" }).metadataPath)?.title, "Title BV1demo");

    const playlist = buildPlaylistFromCache(root);
    assert.equal(playlist.playlist.itemCount, 2);
    assert.equal(playlist.playlist.cachedItemCount, 2);
    assert.equal(playlist.items[0]?.audioUrl, "/api/audio/BV1demo");
    assert.equal(playlist.items[0]?.coverUrl, "/api/cover/BV1demo");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("previews a Bilibili video collection from desktop initial state", async () => {
  const html = `
    <script>
      window.__INITIAL_STATE__={
        "videoData":{
          "owner":{"name":"天花板上吊着猫"},
          "ugc_season":{
            "id":6609608,
            "title":"不存在的电台",
            "sections":[{
              "episodes":[{
                "bvid":"BV1NFq2B8EVS",
                "title":"[SUNO V5] 我要快乐 DnB cover",
                "arc":{
                  "pic":"http://i2.hdslb.com/bfs/archive/song.jpg",
                  "duration":249,
                  "author":{"name":"天花板上吊着猫"}
                }
              }]
            }]
          }
        }
      };
    </script>
  `;
  const fetchImpl = async (url) => {
    assert.match(String(url), /\/video\/BV1NFq2B8EVS/);
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8"
      }
    });
  };

  assert.deepEqual(
    await fetchBilibiliFavoritePreview({
      url: "https://www.bilibili.com/video/BV1NFq2B8EVS/?spm_id_from=333.1007.top_right_bar_window_custom_collection.content.click",
      fetchImpl
    }),
    {
      collectionId: "bilibili-season-6609608",
      mediaId: "6609608",
      title: "不存在的电台",
      mid: null,
      totalCount: 1,
      items: [
        {
          id: "6609608-BV1NFq2B8EVS-1",
          bvid: "BV1NFq2B8EVS",
          title: "[SUNO V5] 我要快乐 DnB cover",
          url: "https://www.bilibili.com/video/BV1NFq2B8EVS",
          coverUrl: "/api/cover-proxy?url=https%3A%2F%2Fi2.hdslb.com%2Fbfs%2Farchive%2Fsong.jpg",
          ownerName: "天花板上吊着猫",
          durationSeconds: 249,
          isExcluded: false
        }
      ]
    },
  );
});

test("previews Bilibili list links with a conservative page size", async () => {
  const requestedPageSizes = [];
  const fetchImpl = async (url) => {
    const requestUrl = new URL(String(url));
    const pageSize = Number(requestUrl.searchParams.get("ps"));
    requestedPageSizes.push(pageSize);

    if (pageSize > 20) {
      return Response.json({ code: -400, message: "请求错误", ttl: 1 });
    }

    return Response.json({
      code: 0,
      message: "OK",
      ttl: 1,
      data: {
        info: {
          id: 3960775205,
          title: "歌单？",
          media_count: 1,
          upper: { mid: 4394705, name: "Blaxmith" }
        },
        medias: [
          {
            bvid: "BV1NFq2B8EVS",
            title: "[SUNO V5] 我要快乐 DnB cover (原唱: 张惠妹)",
            cover: "http://i2.hdslb.com/bfs/archive/song.jpg",
            upper: { name: "天花板上吊着猫" },
            duration: 258
          }
        ],
        has_more: false
      }
    });
  };

  const preview = await fetchBilibiliFavoritePreview({
    url: "https://www.bilibili.com/list/ml3960775205?spm_id_from=333.1387.0.0&oid=115755324543781&bvid=BV1NFq2B8EVS",
    fetchImpl
  });

  assert.deepEqual(requestedPageSizes, [20]);
  assert.equal(preview.collectionId, "bilibili-3960775205");
  assert.equal(preview.mediaId, "3960775205");
  assert.equal(preview.title, "歌单？");
  assert.equal(preview.totalCount, 1);
  assert.equal(preview.items.length, 1);
  assert.equal(preview.items[0]?.bvid, "BV1NFq2B8EVS");
  assert.equal(preview.items[0]?.coverUrl, "/api/cover-proxy?url=https%3A%2F%2Fi2.hdslb.com%2Fbfs%2Farchive%2Fsong.jpg");
});
