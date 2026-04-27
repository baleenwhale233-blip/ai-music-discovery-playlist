#!/usr/bin/env node

import {
  fetchText,
  getApiBaseUrl,
  getWebBaseUrl,
  readAlphaEnv,
  runAlphaPreflight,
} from "./lib/alpha-env.mjs";

const env = readAlphaEnv();

try {
  await runAlphaPreflight({ requireRunningServices: true });

  const apiBaseUrl = getApiBaseUrl(env);
  const webBaseUrl = getWebBaseUrl(env);

  await assertHttpOk(`${apiBaseUrl}/health`, "API health");
  await assertHttpOk(webBaseUrl, "Web root", { method: "HEAD" });
  await assertAlphaLogin(apiBaseUrl, env);

  console.log("[ok] Alpha Web smoke verification passed");
} catch (error) {
  console.error(`[fail] ${error instanceof Error ? error.message : String(error)}`);
  console.error("");
  console.error("Expected running services:");
  console.error("- terminal 1: pnpm dev:api");
  console.error("- terminal 2: pnpm dev:web");
  process.exit(1);
}

async function assertHttpOk(url, label, options = {}) {
  const result = await fetchText(url, {
    method: options.method ?? "GET",
    timeoutMs: options.timeoutMs ?? 4000,
  });

  if (!result.ok && result.status >= 500) {
    throw new Error(`${label} returned ${result.status}`);
  }

  if (result.status < 200 || result.status >= 500) {
    throw new Error(`${label} returned unexpected ${result.status}`);
  }

  console.log(`[ok] ${label} - ${result.status}`);
}

async function assertAlphaLogin(apiBaseUrl, env) {
  const result = await fetchText(`${apiBaseUrl}/auth/verify-code`, {
    method: "POST",
    timeoutMs: 6000,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      phoneOrEmail: "alpha-smoke@example.test",
      inviteCode: env.api.ALPHA_INVITE_CODE,
      code: env.api.ALPHA_LOGIN_CODE,
    }),
  });

  if (!result.ok) {
    throw new Error(`Alpha login smoke returned ${result.status}: ${result.text.slice(0, 240)}`);
  }

  let payload;

  try {
    payload = JSON.parse(result.text);
  } catch {
    throw new Error("Alpha login smoke did not return JSON");
  }

  if (!payload.accessToken || !payload.expiresIn) {
    throw new Error("Alpha login smoke did not return an access token");
  }

  console.log("[ok] Alpha login smoke - access token received");
}
