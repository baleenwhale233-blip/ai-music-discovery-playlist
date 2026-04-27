#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  formatCommandFailure,
  parseDatabaseUrl,
  readAlphaEnv,
  repoRoot,
  runApiPrisma,
  runCommand,
} from "./lib/alpha-env.mjs";

const apiEnvPath = path.join(repoRoot, "apps", "api", ".env");
const apiEnvExamplePath = path.join(repoRoot, "apps", "api", ".env.example");

try {
  const env = readAlphaEnv();
  const psqlPath = findPsql();

  if (!psqlPath) {
    throw new Error(
      [
        "psql was not found.",
        "Recommended Homebrew setup:",
        "  brew install postgresql@16",
        "  brew services start postgresql@16",
        "Then rerun:",
        "  pnpm setup:alpha-db",
      ].join("\n"),
    );
  }

  const databaseUrl = await chooseDatabaseUrl(psqlPath, env);
  maybeWriteApiEnv(databaseUrl);
  await ensureDatabase(psqlPath, databaseUrl);
  runPrismaOrThrow(["migrate", "deploy", "--schema", "prisma/schema.prisma"], databaseUrl);
  runPrismaOrThrow(["generate", "--schema", "prisma/schema.prisma"], databaseUrl);

  console.log("[ok] Alpha PostgreSQL database is ready");
  console.log(`[ok] DATABASE_URL=${redactDatabaseUrl(databaseUrl)}`);
} catch (error) {
  console.error(`[fail] ${error instanceof Error ? error.message : String(error)}`);
  console.error("");
  console.error(
    "This script does not require Docker. It expects a local PostgreSQL service and psql.",
  );
  process.exit(1);
}

function findPsql() {
  const candidates = [
    "/opt/homebrew/opt/postgresql@16/bin/psql",
    "/usr/local/opt/postgresql@16/bin/psql",
    "/opt/homebrew/bin/psql",
    "/usr/local/bin/psql",
    "/Applications/Postgres.app/Contents/Versions/latest/bin/psql",
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  const which = runCommand("which", ["psql"]);

  return which.status === 0 ? which.stdout.trim() : null;
}

async function chooseDatabaseUrl(psqlPath, env) {
  const hasLocalEnv = existsSync(apiEnvPath);
  const configured = env.api.DATABASE_URL;
  const candidates = hasLocalEnv
    ? [configured]
    : unique([
        configured,
        `postgresql://${encodeURIComponent(os.userInfo().username)}@localhost:5432/ai_music_playlist`,
      ]);

  const failures = [];

  for (const candidate of candidates) {
    const maintenanceUrl = toMaintenanceDatabaseUrl(candidate);
    const result = runPsql(psqlPath, maintenanceUrl, "select 1;");

    if (result.status === 0) {
      return candidate;
    }

    failures.push(`${redactDatabaseUrl(candidate)}\n${formatCommandFailure(result)}`);
  }

  throw new Error(
    [
      "Unable to connect to local PostgreSQL with the known Alpha DATABASE_URL options.",
      "If you are using Homebrew PostgreSQL, start it with:",
      "  brew services start postgresql@16",
      "If your local role is different, create apps/api/.env with DATABASE_URL first.",
      "",
      "Connection attempts:",
      failures.join("\n\n"),
    ].join("\n"),
  );
}

function maybeWriteApiEnv(databaseUrl) {
  if (existsSync(apiEnvPath)) {
    return;
  }

  const example = readFileSync(apiEnvExamplePath, "utf8");
  const next = example.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${databaseUrl}`);

  writeFileSync(apiEnvPath, next, "utf8");
  console.log("[ok] wrote apps/api/.env from apps/api/.env.example");
}

async function ensureDatabase(psqlPath, databaseUrl) {
  const parsed = parseDatabaseUrl(databaseUrl);
  const maintenanceUrl = toMaintenanceDatabaseUrl(databaseUrl);
  const existsSql = `select 1 from pg_database where datname = ${sqlString(parsed.databaseName)};`;
  const existsResult = runPsql(psqlPath, maintenanceUrl, existsSql);

  if (existsResult.status !== 0) {
    throw new Error(
      `Unable to inspect PostgreSQL databases:\n${formatCommandFailure(existsResult)}`,
    );
  }

  if (existsResult.stdout.trim() === "1") {
    console.log(`[ok] database ${parsed.databaseName} exists`);
    return;
  }

  const createSql = `create database ${sqlIdent(parsed.databaseName)};`;
  const createResult = runPsql(psqlPath, maintenanceUrl, createSql);

  if (createResult.status !== 0) {
    throw new Error(
      `Unable to create database ${parsed.databaseName}:\n${formatCommandFailure(createResult)}`,
    );
  }

  console.log(`[ok] created database ${parsed.databaseName}`);
}

function runPrismaOrThrow(args, databaseUrl) {
  const result = runApiPrisma(args, {
    api: {
      DATABASE_URL: databaseUrl,
    },
  });

  if (result.status !== 0) {
    throw new Error(`Prisma command failed:\n${formatCommandFailure(result)}`);
  }

  console.log(`[ok] prisma ${args.slice(0, 2).join(" ")}`);
}

function runPsql(psqlPath, databaseUrl, sql) {
  return runCommand(psqlPath, [databaseUrl, "--tuples-only", "--no-align", "--command", sql], {
    env: {
      PGCONNECT_TIMEOUT: "3",
    },
  });
}

function toMaintenanceDatabaseUrl(databaseUrl) {
  const parsed = new URL(databaseUrl);
  parsed.pathname = "/postgres";

  return parsed.toString();
}

function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlIdent(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function unique(values) {
  return Array.from(new Set(values));
}

function redactDatabaseUrl(databaseUrl) {
  const parsed = new URL(databaseUrl);

  if (parsed.password) {
    parsed.password = "****";
  }

  return parsed.toString();
}
