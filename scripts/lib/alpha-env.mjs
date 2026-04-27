import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const apiDir = path.join(repoRoot, "apps", "api");
export const webDir = path.join(repoRoot, "apps", "web");

const apiEnvExamplePath = path.join(apiDir, ".env.example");
const apiEnvPath = path.join(apiDir, ".env");
const webEnvExamplePath = path.join(webDir, ".env.example");
const webEnvPath = path.join(webDir, ".env");

export function parseDotEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const values = {};
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

export function readAlphaEnv() {
  const apiExample = parseDotEnvFile(apiEnvExamplePath);
  const apiLocal = parseDotEnvFile(apiEnvPath);
  const webExample = parseDotEnvFile(webEnvExamplePath);
  const webLocal = parseDotEnvFile(webEnvPath);

  const api = {
    ...apiExample,
    ...apiLocal,
    ...pickDefined(process.env, Object.keys(apiExample)),
  };
  const web = {
    ...webExample,
    ...webLocal,
    ...pickDefined(process.env, Object.keys(webExample)),
  };

  api.PORT ??= "4000";
  api.API_PREFIX ??= "api/v1";
  api.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ai_music_playlist";
  api.REDIS_URL ??= "redis://localhost:6379";
  api.ALPHA_LOGIN_CODE ??= "246810";
  api.ALPHA_INVITE_CODE ??= "alpha-50";
  web.NEXT_PUBLIC_API_BASE_URL ??= `http://127.0.0.1:${api.PORT}/${api.API_PREFIX}`;

  return {
    api,
    web,
    paths: {
      apiEnvExamplePath,
      apiEnvPath,
      webEnvExamplePath,
      webEnvPath,
    },
  };
}

export function parseDatabaseUrl(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);

    return {
      url: parsed,
      host: parsed.hostname || "localhost",
      port: Number(parsed.port || "5432"),
      databaseName: decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "postgres",
    };
  } catch (error) {
    throw new Error(
      `Invalid DATABASE_URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function getApiBaseUrl(env = readAlphaEnv()) {
  return `http://127.0.0.1:${env.api.PORT}/${env.api.API_PREFIX.replace(/^\/+|\/+$/g, "")}`;
}

export function getWebBaseUrl(env = readAlphaEnv()) {
  return "http://127.0.0.1:3020";
}

export async function canConnectTcp({ host, port, timeoutMs = 1200 }) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);

    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.end();
      resolve(true);
    });
    socket.once("error", () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(false);
    });
  });
}

export async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 2500);

  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });
    const text = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      text,
      response,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: {
      ...process.env,
      ...options.env,
    },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error,
  };
}

export function commandExists(command, extraCandidates = []) {
  for (const candidate of extraCandidates) {
    if (isExecutableFile(candidate)) {
      return candidate;
    }
  }

  const which = runCommand("which", [command], {
    stdio: "pipe",
  });

  return which.status === 0 ? which.stdout.trim() : null;
}

export function runPnpm(args, options = {}) {
  return runCommand("pnpm", args, options);
}

export function runApiPrisma(args, env = readAlphaEnv()) {
  return runPnpm(["--filter", "@ai-music-playlist/api", "exec", "prisma", ...args], {
    env: {
      DATABASE_URL: env.api.DATABASE_URL,
    },
  });
}

export function formatCommandFailure(result) {
  const lines = [];

  if (result.error) {
    lines.push(String(result.error));
  }

  if (result.stdout.trim()) {
    lines.push(result.stdout.trim());
  }

  if (result.stderr.trim()) {
    lines.push(result.stderr.trim());
  }

  return lines.join("\n");
}

export function printCheck(name, status, detail = "") {
  const prefix = status === "pass" ? "[ok]" : status === "warn" ? "[warn]" : "[fail]";
  console.log(`${prefix} ${name}${detail ? ` - ${detail}` : ""}`);
}

export function checkNodeVersion() {
  const version = process.versions.node;
  const major = Number(version.split(".")[0]);

  if (major !== 22) {
    return {
      ok: false,
      detail: `current v${version}; run nvm use or install Node 22 LTS`,
    };
  }

  return {
    ok: true,
    detail: `v${version}`,
  };
}

export function checkDependenciesInstalled() {
  const nodeModulesPath = path.join(repoRoot, "node_modules");
  const pnpmStorePath = path.join(nodeModulesPath, ".pnpm");

  if (!existsSync(nodeModulesPath) || !existsSync(pnpmStorePath)) {
    return {
      ok: false,
      detail: "node_modules is missing; run pnpm install",
    };
  }

  return {
    ok: true,
    detail: "node_modules present",
  };
}

export function checkPnpmVersion() {
  const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const expected = String(packageJson.packageManager ?? "pnpm@").replace(/^pnpm@/, "");
  const result = runPnpm(["--version"]);

  if (result.status !== 0) {
    return {
      ok: false,
      detail: "pnpm is missing; install pnpm 9.15.0",
    };
  }

  const actual = result.stdout.trim();
  const expectedMajor = expected.split(".")[0];
  const actualMajor = actual.split(".")[0];

  if (expectedMajor && actualMajor !== expectedMajor) {
    return {
      ok: false,
      detail: `current ${actual}; expected pnpm ${expected}`,
    };
  }

  return {
    ok: true,
    detail: actual,
  };
}

export function checkExecutable(name) {
  const found = commandExists(name, [
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/opt/homebrew/opt/${name}/bin/${name}`,
    `/usr/local/opt/${name}/bin/${name}`,
  ]);

  if (!found) {
    return {
      ok: false,
      detail: `${name} not found; install with brew install yt-dlp ffmpeg`,
    };
  }

  return {
    ok: true,
    detail: found,
  };
}

export async function checkApiPort(env, requireRunningServices, requireFreeDevPorts = false) {
  const port = Number(env.api.PORT);
  const listening = await canConnectTcp({ host: "127.0.0.1", port });

  if (!listening) {
    return requireRunningServices
      ? {
          ok: false,
          detail: `API is not listening on ${port}; start pnpm dev:api`,
        }
      : {
          ok: true,
          detail: `${port} is free`,
        };
  }

  if (requireFreeDevPorts) {
    return {
      ok: false,
      detail: `${port} is already occupied; stop the existing API before launching a new dev session`,
    };
  }

  const healthUrl = `${getApiBaseUrl(env)}/health`;

  try {
    const health = await fetchText(healthUrl, { timeoutMs: 2500 });

    if (health.ok) {
      return {
        ok: true,
        detail: `${port} responds at /health`,
      };
    }

    return {
      ok: false,
      detail: `${port} is occupied but ${healthUrl} returned ${health.status}`,
    };
  } catch {
    return {
      ok: false,
      detail: `${port} is occupied but ${healthUrl} did not respond; stop the stale process`,
    };
  }
}

export async function checkWebPort(env, requireRunningServices, requireFreeDevPorts = false) {
  const port = 3020;
  const listening = await canConnectTcp({ host: "127.0.0.1", port });

  if (!listening) {
    return requireRunningServices
      ? {
          ok: false,
          detail: "Web is not listening on 3020; start pnpm dev:web",
        }
      : {
          ok: true,
          detail: "3020 is free",
        };
  }

  if (requireFreeDevPorts) {
    return {
      ok: false,
      detail:
        "3020 is already occupied; stop the existing Web dev server before launching a new one",
    };
  }

  try {
    const health = await fetchText(getWebBaseUrl(env), {
      method: "HEAD",
      timeoutMs: 3500,
    });

    if (health.status >= 200 && health.status < 500) {
      return {
        ok: true,
        detail: "3020 responds",
      };
    }

    return {
      ok: false,
      detail: `3020 is occupied but returned ${health.status}`,
    };
  } catch {
    return {
      ok: false,
      detail: "3020 is occupied but not responding; stop the stale Next process",
    };
  }
}

export async function checkDatabasePort(env) {
  const parsed = parseDatabaseUrl(env.api.DATABASE_URL);
  const listening = await canConnectTcp({ host: parsed.host, port: parsed.port });

  if (!listening) {
    return {
      ok: false,
      detail: `${parsed.host}:${parsed.port} is not reachable; start PostgreSQL before Alpha login`,
    };
  }

  return {
    ok: true,
    detail: `${parsed.host}:${parsed.port} is reachable`,
  };
}

export async function checkRedisPort(env) {
  const url = new URL(env.api.REDIS_URL);
  const host = url.hostname || "localhost";
  const port = Number(url.port || "6379");
  const listening = await canConnectTcp({ host, port, timeoutMs: 800 });

  if (!listening) {
    return {
      ok: true,
      warn: true,
      detail: `${host}:${port} is not reachable; Redis is optional for current Alpha smoke`,
    };
  }

  return {
    ok: true,
    detail: `${host}:${port} is reachable`,
  };
}

export function checkPrismaMigrations(env) {
  const status = runApiPrisma(["migrate", "status", "--schema", "prisma/schema.prisma"], env);

  if (status.status !== 0) {
    return {
      ok: false,
      detail: formatCommandFailure(status) || "prisma migrate status failed",
    };
  }

  return {
    ok: true,
    detail: "database schema is up to date",
  };
}

export async function runAlphaPreflight(options = {}) {
  const requireRunningServices = Boolean(options.requireRunningServices);
  const requireFreeDevPorts = Boolean(options.requireFreeDevPorts);
  const env = readAlphaEnv();
  const checks = [];

  checks.push(["Node", checkNodeVersion()]);
  checks.push(["pnpm", checkPnpmVersion()]);
  checks.push(["dependencies", checkDependenciesInstalled()]);
  checks.push(["ffmpeg", checkExecutable("ffmpeg")]);
  checks.push(["yt-dlp", checkExecutable("yt-dlp")]);
  checks.push(["API port", await checkApiPort(env, requireRunningServices, requireFreeDevPorts)]);
  checks.push(["Web port", await checkWebPort(env, requireRunningServices, requireFreeDevPorts)]);
  checks.push(["PostgreSQL port", await checkDatabasePort(env)]);
  checks.push(["Redis port", await checkRedisPort(env)]);

  if (checks.every(([, check]) => check.ok)) {
    checks.push(["Prisma migrations", checkPrismaMigrations(env)]);
  }

  for (const [name, check] of checks) {
    printCheck(name, check.warn ? "warn" : check.ok ? "pass" : "fail", check.detail);
  }

  const failed = checks.filter(([, check]) => !check.ok);

  if (failed.length > 0) {
    throw new Error(`Alpha preflight failed with ${failed.length} blocking issue(s)`);
  }

  return env;
}

function pickDefined(source, keys) {
  const result = {};

  for (const key of keys) {
    if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }

  return result;
}

function isExecutableFile(filePath) {
  try {
    const stats = statSync(filePath);

    return stats.isFile() && Boolean(stats.mode & 0o111);
  } catch {
    return false;
  }
}
