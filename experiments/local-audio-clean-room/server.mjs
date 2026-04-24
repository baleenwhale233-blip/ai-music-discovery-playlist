import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BILIBILI_DESKTOP_USER_AGENT,
  cacheBilibiliAudio,
  CLEAN_ROOM_CACHE_DIR,
  clearCache,
  deleteCacheItem,
  fetchBilibiliFavoritePreview,
  findCachedAudioFile,
  getCachePaths,
  buildPlaylistFromCache,
  normalizeBilibiliCoverUrl,
  parseHttpRange,
  readMetadata
} from "./core.mjs";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3010;
const DEFAULT_CACHE_ROOT = resolve(process.cwd(), CLEAN_ROOM_CACHE_DIR);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendHtml(response, html) {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(html);
}

function sendNotFound(response) {
  sendJson(response, 404, { message: "Not found" });
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;

    if (size > 1024 * 1024) {
      throw new Error("Request body is too large");
    }

    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString("utf8").trim();
  return body ? JSON.parse(body) : {};
}

function handleAudioRequest(response, request, cacheRoot, cacheKey) {
  const paths = getCachePaths({ cacheRoot, cacheKey });
  const audioFile = findCachedAudioFile(paths.itemDir);

  if (!audioFile || !existsSync(audioFile)) {
    sendNotFound(response);
    return;
  }

  const totalSize = statSync(audioFile).size;
  const range = parseHttpRange(request.headers.range, totalSize);
  const baseHeaders = {
    "content-type": "audio/mp4",
    "cache-control": "private, max-age=3600",
    "accept-ranges": "bytes"
  };

  if (range) {
    response.writeHead(206, {
      ...baseHeaders,
      "content-range": range.contentRange,
      "content-length": range.chunkSize
    });
    createReadStream(audioFile, { start: range.start, end: range.end }).pipe(response);
    return;
  }

  response.writeHead(200, {
    ...baseHeaders,
    "content-length": totalSize
  });
  createReadStream(audioFile).pipe(response);
}

async function handleCoverRequest(response, cacheRoot, cacheKey, fetchImpl) {
  const paths = getCachePaths({ cacheRoot, cacheKey });
  const metadata = readMetadata(paths.metadataPath);

  if (!metadata?.coverUrl) {
    sendNotFound(response);
    return;
  }

  const coverResponse = await fetchImpl(metadata.coverUrl, {
    headers: {
      "user-agent": BILIBILI_DESKTOP_USER_AGENT,
      referer: "https://www.bilibili.com/"
    }
  });

  if (!coverResponse.ok) {
    sendJson(response, coverResponse.status, { message: "Unable to load cover image" });
    return;
  }

  const body = Buffer.from(await coverResponse.arrayBuffer());
  response.writeHead(200, {
    "content-type": coverResponse.headers.get("content-type") ?? "image/jpeg",
    "cache-control": "private, max-age=3600",
    "content-length": body.length
  });
  response.end(body);
}

function isAllowedBilibiliImageHost(hostname) {
  const lower = hostname.toLowerCase();

  return lower === "hdslb.com" || lower.endsWith(".hdslb.com") || lower === "biliimg.com" || lower.endsWith(".biliimg.com");
}

function parseRemoteCoverUrl(rawUrl) {
  const normalized = normalizeBilibiliCoverUrl(rawUrl);

  if (!normalized) {
    throw new Error("Missing cover url");
  }

  const url = new URL(normalized);

  if (url.protocol !== "https:") {
    throw new Error("Unsupported cover url protocol");
  }

  if (!isAllowedBilibiliImageHost(url.hostname)) {
    throw new Error("Unsupported cover url host");
  }

  return url.toString();
}

async function handleRemoteCoverRequest(response, requestUrl, fetchImpl) {
  let coverUrl;

  try {
    coverUrl = parseRemoteCoverUrl(requestUrl.searchParams.get("url"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid cover url";
    sendJson(response, 400, { message });
    return;
  }

  const coverResponse = await fetchImpl(coverUrl, {
    headers: {
      "user-agent": BILIBILI_DESKTOP_USER_AGENT,
      referer: "https://www.bilibili.com/"
    }
  });

  if (!coverResponse.ok) {
    sendJson(response, coverResponse.status, { message: "Unable to load cover image" });
    return;
  }

  const body = Buffer.from(await coverResponse.arrayBuffer());
  response.writeHead(200, {
    "content-type": coverResponse.headers.get("content-type") ?? "image/jpeg",
    "cache-control": "private, max-age=3600",
    "content-length": body.length
  });
  response.end(body);
}

export function createCleanRoomServer(options = {}) {
  const cacheRoot = options.cacheRoot ?? DEFAULT_CACHE_ROOT;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

      if (request.method === "GET" && url.pathname === "/") {
        sendHtml(response, renderPage());
        return;
      }

      if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, {
          name: "local-audio-clean-room",
          ok: true,
          cacheRoot,
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/playlist") {
        sendJson(response, 200, buildPlaylistFromCache(cacheRoot));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/cache") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await cacheBilibiliAudio({ url: body.url, cacheRoot, fetchImpl }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/favorite-preview") {
        const body = await readJsonBody(request);
        sendJson(
          response,
          200,
          await fetchBilibiliFavoritePreview({
            url: body.url,
            limit: body.limit,
            fetchImpl
          }),
        );
        return;
      }

      if (request.method === "DELETE" && url.pathname === "/api/playlist") {
        sendJson(response, 200, clearCache(cacheRoot));
        return;
      }

      const playlistItemMatch = url.pathname.match(/^\/api\/playlist\/([^/]+)$/);
      if (request.method === "DELETE" && playlistItemMatch?.[1]) {
        sendJson(response, 200, deleteCacheItem({ cacheRoot, cacheKey: decodeURIComponent(playlistItemMatch[1]) }));
        return;
      }

      const audioMatch = url.pathname.match(/^\/api\/audio\/([^/]+)$/);
      if (request.method === "GET" && audioMatch?.[1]) {
        handleAudioRequest(response, request, cacheRoot, decodeURIComponent(audioMatch[1]));
        return;
      }

      const coverMatch = url.pathname.match(/^\/api\/cover\/([^/]+)$/);
      if (request.method === "GET" && coverMatch?.[1]) {
        await handleCoverRequest(response, cacheRoot, decodeURIComponent(coverMatch[1]), fetchImpl);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/cover-proxy") {
        await handleRemoteCoverRequest(response, url, fetchImpl);
        return;
      }

      sendNotFound(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal server error";
      sendJson(response, 500, { message });
    }
  });
}

function renderPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Local Audio Clean Room</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #101828;
      --muted: #5f6b7a;
      --line: #d7dde7;
      --paper: #f7f4ec;
      --panel: #fffaf0;
      --accent: #0b7285;
      --accent-strong: #083c5a;
      --danger: #a13724;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: ui-serif, Georgia, "Times New Roman", "Songti SC", serif;
      color: var(--ink);
      background:
        linear-gradient(135deg, rgba(11,114,133,0.13), transparent 34%),
        linear-gradient(315deg, rgba(161,55,36,0.12), transparent 40%),
        var(--paper);
    }
    main {
      width: min(980px, 100%);
      margin: 0 auto;
      padding: 28px 18px 80px;
      display: grid;
      gap: 18px;
    }
    header {
      display: grid;
      gap: 8px;
      padding: 18px 0 8px;
    }
    .eyebrow {
      margin: 0;
      color: var(--accent);
      font-size: 12px;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h1, h2, p { margin: 0; }
    h1 { font-size: clamp(30px, 8vw, 52px); line-height: 1; }
    h2 { font-size: 20px; }
    .subhead { color: var(--muted); line-height: 1.7; max-width: 760px; }
    section {
      display: grid;
      gap: 14px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255,250,240,0.82);
      box-shadow: 0 16px 45px rgba(16,24,40,0.08);
    }
    textarea {
      width: 100%;
      min-height: 92px;
      resize: vertical;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 13px 14px;
      font: 15px/1.55 ui-sans-serif, system-ui, sans-serif;
      color: var(--ink);
      background: rgba(255,255,255,0.78);
    }
    button {
      border: 1px solid var(--accent-strong);
      border-radius: 8px;
      padding: 11px 14px;
      color: #fff;
      background: var(--accent-strong);
      font: 700 14px/1 ui-sans-serif, system-ui, sans-serif;
      cursor: pointer;
    }
    button.secondary { color: var(--accent-strong); background: #fff; }
    button.danger { border-color: var(--danger); color: var(--danger); background: #fff; }
    button:disabled { opacity: 0.48; cursor: not-allowed; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .status {
      padding: 12px 14px;
      border-radius: 8px;
      background: rgba(11,114,133,0.1);
      color: var(--accent-strong);
      font: 600 14px/1.5 ui-sans-serif, system-ui, sans-serif;
    }
    .row {
      display: grid;
      grid-template-columns: 62px minmax(0,1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255,255,255,0.72);
    }
    .candidate-row { grid-template-columns: auto 62px minmax(0,1fr) auto; }
    .candidate-check {
      width: 20px;
      height: 20px;
      accent-color: var(--accent-strong);
    }
    .thumb {
      width: 62px;
      height: 62px;
      border-radius: 8px;
      object-fit: cover;
      background: #dbe7e8;
    }
    .title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 800;
    }
    .meta {
      margin-top: 4px;
      color: var(--muted);
      font: 13px/1.4 ui-sans-serif, system-ui, sans-serif;
    }
    .player {
      display: grid;
      gap: 12px;
      grid-template-columns: 116px minmax(0,1fr);
      align-items: center;
    }
    .player img, .player .thumb { width: 116px; height: 116px; }
    audio { width: 100%; grid-column: 1 / -1; }
    @media (max-width: 620px) {
      main { padding-inline: 14px; }
      .row { grid-template-columns: 52px minmax(0,1fr); }
      .row button { grid-column: 1 / -1; }
      .candidate-row { grid-template-columns: auto 52px minmax(0,1fr); }
      .candidate-row button { grid-column: 1 / -1; }
      .thumb { width: 52px; height: 52px; }
      .player { grid-template-columns: 88px minmax(0,1fr); }
      .player img, .player .thumb { width: 88px; height: 88px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="eyebrow">Clean Room Experiment</p>
      <h1>本地音频听单</h1>
      <p class="subhead">一个独立进程验证“B 站链接 -> 用户主动缓存 -> 原生 audio 播放”的最小闭环。它不依赖现有 Nest、Next、Prisma 或双端口调试。</p>
    </header>

    <section>
      <h2>单条缓存</h2>
      <textarea id="singleUrl" placeholder="贴入 B 站视频链接，例如 https://www.bilibili.com/video/BV..."></textarea>
      <div class="actions">
        <button id="cacheSingle">保存为本地音频</button>
        <button id="refresh" class="secondary">刷新听单</button>
      </div>
    </section>

    <section>
      <h2>合集 / 收藏夹候选</h2>
      <textarea id="favoriteUrl" placeholder="贴入 B 站合集、收藏夹或播放列表链接，例如 video/BV...custom_collection / collectiondetail?sid=... / favlist?fid=..."></textarea>
      <div class="actions">
        <button id="previewFavorite">解析候选</button>
        <button id="selectAllCandidates" class="secondary" disabled>全选</button>
        <button id="invertCandidateSelection" class="secondary" disabled>反选</button>
        <button id="clearCandidateSelection" class="secondary" disabled>清空选择</button>
        <button id="deleteSelectedCandidates" class="danger" disabled>删除已选</button>
        <button id="cacheCandidates" class="secondary" disabled>缓存已选</button>
      </div>
      <div id="candidateSummary" class="meta">解析后在这里筛选要缓存的歌曲。</div>
      <div id="candidates"></div>
    </section>

    <section>
      <h2>听单</h2>
      <div id="status" class="status">正在读取本地缓存。</div>
      <div class="actions">
        <button id="clearPlaylist" class="danger">清空本地缓存</button>
      </div>
      <div id="nowPlaying"></div>
      <div id="playlist"></div>
    </section>
  </main>

  <script>
    const state = {
      playlist: null,
      currentIndex: 0,
      candidates: [],
      selectedCandidateIds: new Set(),
      busy: false
    };

    const $ = (id) => document.getElementById(id);

    async function requestJson(url, options = {}) {
      const response = await fetch(url, {
        ...options,
        headers: {
          "content-type": "application/json",
          ...(options.headers || {})
        }
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "请求失败");
      }

      return payload;
    }

    function setStatus(message) {
      $("status").textContent = message;
    }

    function setBusy(isBusy) {
      state.busy = isBusy;
      $("cacheSingle").disabled = isBusy;
      $("previewFavorite").disabled = isBusy;
      updateCandidateControls();
    }

    async function refreshPlaylist() {
      state.playlist = await requestJson("/api/playlist");
      if (state.currentIndex >= state.playlist.items.length) {
        state.currentIndex = 0;
      }
      render();
    }

    async function cacheUrl(url) {
      return requestJson("/api/cache", {
        method: "POST",
        body: JSON.stringify({ url })
      });
    }

    async function cacheSingle() {
      const url = $("singleUrl").value.trim();
      if (!url) {
        setStatus("请先贴入一个 B 站视频链接。");
        return;
      }

      setBusy(true);
      setStatus("正在生成本地音频，首次缓存可能需要几十秒。");

      try {
        const item = await cacheUrl(url);
        $("singleUrl").value = "";
        await refreshPlaylist();
        setStatus(item.message + " " + item.title);
      } catch (error) {
        setStatus(error.message || "生成失败");
      } finally {
        setBusy(false);
      }
    }

    async function previewFavorite() {
      const url = $("favoriteUrl").value.trim();
      if (!url) {
        setStatus("请先贴入一个 B 站合集、收藏夹或播放列表链接。");
        return;
      }

      setBusy(true);
      setStatus("正在解析候选，只拿目录数据，不会开始缓存音频。");

      try {
        const preview = await requestJson("/api/favorite-preview", {
          method: "POST",
          body: JSON.stringify({ url })
        });
        state.candidates = preview.items;
        state.selectedCandidateIds = new Set();
        const totalText = preview.totalCount && preview.totalCount !== preview.items.length
          ? preview.items.length + " / " + preview.totalCount + " 条"
          : preview.items.length + " 条";
        setStatus("已解析候选：" + (preview.title || preview.mediaId) + " / " + totalText);
        renderCandidates();
      } catch (error) {
        setStatus(error.message || "解析收藏夹失败");
      } finally {
        setBusy(false);
      }
    }

    function getSelectedCandidates() {
      return state.candidates.filter((item) => state.selectedCandidateIds.has(item.id));
    }

    async function cacheCandidates() {
      const selected = getSelectedCandidates();
      if (selected.length === 0) {
        setStatus("请先选择要缓存的候选。");
        return;
      }

      setBusy(true);

      try {
        let count = 0;
        for (const item of selected) {
          setStatus("正在缓存：" + item.title);
          await cacheUrl(item.url);
          count += 1;
        }
        state.candidates = state.candidates.filter((item) => !state.selectedCandidateIds.has(item.id));
        state.selectedCandidateIds = new Set();
        if (state.candidates.length === 0) {
          $("favoriteUrl").value = "";
        }
        renderCandidates();
        await refreshPlaylist();
        setStatus("已缓存 " + count + " 条已选候选。");
      } catch (error) {
        setStatus(error.message || "批量缓存失败");
      } finally {
        setBusy(false);
      }
    }

    async function removePlaylistItem(cacheKey) {
      await requestJson("/api/playlist/" + encodeURIComponent(cacheKey), { method: "DELETE" });
      await refreshPlaylist();
      setStatus("已移除本地缓存：" + cacheKey);
    }

    async function clearPlaylist() {
      setBusy(true);
      try {
        await requestJson("/api/playlist", { method: "DELETE" });
        await refreshPlaylist();
        setStatus("已清空本地缓存。");
      } catch (error) {
        setStatus(error.message || "清空失败");
      } finally {
        setBusy(false);
      }
    }

    function updateCandidateControls() {
      const candidateCount = state.candidates.length;
      const selectedCount = getSelectedCandidates().length;
      $("selectAllCandidates").disabled = state.busy || candidateCount === 0;
      $("invertCandidateSelection").disabled = state.busy || candidateCount === 0;
      $("clearCandidateSelection").disabled = state.busy || selectedCount === 0;
      $("deleteSelectedCandidates").disabled = state.busy || selectedCount === 0;
      $("cacheCandidates").disabled = state.busy || selectedCount === 0;
      $("candidateSummary").textContent = candidateCount
        ? "已选 " + selectedCount + " / 候选 " + candidateCount
        : "解析后在这里筛选要缓存的歌曲。";
    }

    function renderCandidates() {
      $("candidates").innerHTML = state.candidates.map((item) => candidateRowTemplate(item, {
        actionLabel: "删除候选",
        action: "removeCandidate",
        id: item.id
      })).join("");
      updateCandidateControls();
    }

    window.removeCandidate = function removeCandidate(id) {
      state.candidates = state.candidates.filter((item) => item.id !== id);
      state.selectedCandidateIds.delete(id);
      renderCandidates();
      setStatus("已从当前候选列表删除一条。");
    };

    window.toggleCandidateSelected = function toggleCandidateSelected(id, checked) {
      if (checked) {
        state.selectedCandidateIds.add(id);
      } else {
        state.selectedCandidateIds.delete(id);
      }
      updateCandidateControls();
    };

    function selectAllCandidates() {
      state.selectedCandidateIds = new Set(state.candidates.map((item) => item.id));
      renderCandidates();
      setStatus("已全选当前候选。");
    }

    function invertCandidateSelection() {
      state.selectedCandidateIds = new Set(
        state.candidates
          .filter((item) => !state.selectedCandidateIds.has(item.id))
          .map((item) => item.id),
      );
      renderCandidates();
      setStatus("已反选当前候选。");
    }

    function clearCandidateSelection() {
      state.selectedCandidateIds = new Set();
      renderCandidates();
      setStatus("已清空候选选择。");
    }

    function deleteSelectedCandidates() {
      const selectedCount = getSelectedCandidates().length;
      if (selectedCount === 0) {
        setStatus("请先选择要删除的候选。");
        return;
      }
      state.candidates = state.candidates.filter((item) => !state.selectedCandidateIds.has(item.id));
      state.selectedCandidateIds = new Set();
      renderCandidates();
      setStatus("已删除 " + selectedCount + " 条已选候选。");
    }

    window.playItem = function playItem(index) {
      state.currentIndex = index;
      render();
      const audio = document.querySelector("audio");
      if (audio) {
        audio.play().catch(() => setStatus("浏览器阻止了自动播放，请手动点击播放。"));
      }
    };

    window.removePlaylistItem = removePlaylistItem;

    function candidateRowTemplate(item, config) {
      const cover = item.coverUrl ? '<img class="thumb" src="' + escapeHtml(item.coverUrl) + '" alt="">' : '<div class="thumb"></div>';
      const meta = (item.ownerName || "未知 UP") + " / " + (item.durationSeconds ? item.durationSeconds + " 秒" : "未知时长");
      const checked = state.selectedCandidateIds.has(item.id) ? " checked" : "";
      return '<div class="row candidate-row">' +
        '<input class="candidate-check" type="checkbox" aria-label="选择候选" ' +
          'onchange="toggleCandidateSelected(\\'' + escapeHtml(item.id) + '\\', this.checked)"' + checked + '>' +
        cover +
        '<div><div class="title">' + escapeHtml(item.title) + '</div><div class="meta">' + escapeHtml(meta) + '</div></div>' +
        '<button class="secondary" onclick="' + config.action + '(\\'' + escapeHtml(config.id) + '\\')">' + config.actionLabel + '</button>' +
      '</div>';
    }

    function rowTemplate(item, config) {
      const cover = item.coverUrl ? '<img class="thumb" src="' + escapeHtml(item.coverUrl) + '" alt="">' : '<div class="thumb"></div>';
      const meta = (item.ownerName || "未知 UP") + " / " + (item.durationSeconds ? item.durationSeconds + " 秒" : "未知时长");
      return '<div class="row">' +
        cover +
        '<div><div class="title">' + escapeHtml(item.title) + '</div><div class="meta">' + escapeHtml(meta) + '</div></div>' +
        '<button class="secondary" onclick="' + config.action + '(\\'' + escapeHtml(config.id) + '\\')">' + config.actionLabel + '</button>' +
      '</div>';
    }

    function render() {
      const items = state.playlist?.items || [];
      const current = items[state.currentIndex];

      $("playlist").innerHTML = items.map((item, index) => {
        const cover = item.coverUrl ? '<img class="thumb" src="' + escapeHtml(item.coverUrl) + '" alt="">' : '<div class="thumb"></div>';
        return '<div class="row">' +
          cover +
          '<button class="secondary title" onclick="playItem(' + index + ')">' + escapeHtml(item.title) + '</button>' +
          '<button class="danger" onclick="removePlaylistItem(\\'' + escapeHtml(item.cacheKey) + '\\')">移除</button>' +
        '</div>';
      }).join("");

      if (!current) {
        $("nowPlaying").innerHTML = "";
        if (!state.busy) {
          setStatus("听单为空。缓存一条 B 站视频后会出现在这里。");
        }
        return;
      }

      const cover = current.coverUrl ? '<img class="thumb" src="' + escapeHtml(current.coverUrl) + '" alt="">' : '<div class="thumb"></div>';
      $("nowPlaying").innerHTML =
        '<div class="player">' +
          cover +
          '<div><p class="eyebrow">Now Playing</p><h2>' + escapeHtml(current.title) + '</h2><p class="meta">' + (state.currentIndex + 1) + " / " + items.length + '</p></div>' +
          '<audio controls preload="metadata" src="' + escapeHtml(current.audioUrl) + '"></audio>' +
        '</div>';

      const audio = document.querySelector("audio");
      audio.onended = () => {
        if (state.currentIndex < items.length - 1) {
          state.currentIndex += 1;
          render();
          document.querySelector("audio")?.play().catch(() => undefined);
          return;
        }
        setStatus("听单已播放完毕。");
      };

      if (!state.busy) {
        setStatus("本地缓存：" + state.playlist.playlist.cachedItemCount + " / " + state.playlist.playlist.itemCount);
      }
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    $("cacheSingle").addEventListener("click", cacheSingle);
    $("previewFavorite").addEventListener("click", previewFavorite);
    $("selectAllCandidates").addEventListener("click", selectAllCandidates);
    $("invertCandidateSelection").addEventListener("click", invertCandidateSelection);
    $("clearCandidateSelection").addEventListener("click", clearCandidateSelection);
    $("deleteSelectedCandidates").addEventListener("click", deleteSelectedCandidates);
    $("cacheCandidates").addEventListener("click", cacheCandidates);
    $("clearPlaylist").addEventListener("click", clearPlaylist);
    $("refresh").addEventListener("click", refreshPlaylist);

    refreshPlaylist().catch((error) => setStatus(error.message || "读取听单失败"));
  </script>
</body>
</html>`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const host = process.env.HOST ?? DEFAULT_HOST;
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const server = createCleanRoomServer();
  const major = Number(process.versions.node.split(".")[0]);

  if (major >= 25) {
    console.warn("Warning: this project is intended to run on Node 22 LTS; current Node is", process.version);
  }

  server.listen(port, host, () => {
    console.log(`Local audio clean-room experiment: http://${host}:${port}`);
    console.log(`Cache root: ${DEFAULT_CACHE_ROOT}`);
  });
}
