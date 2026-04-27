#!/usr/bin/env node

import { runAlphaPreflight } from "./lib/alpha-env.mjs";

const requireRunningServices = process.argv.includes("--require-running-services");
const requireFreeDevPorts = process.argv.includes("--require-free-dev-ports");

try {
  await runAlphaPreflight({ requireRunningServices, requireFreeDevPorts });
  console.log("[ok] Alpha environment preflight passed");
} catch (error) {
  console.error(`[fail] ${error instanceof Error ? error.message : String(error)}`);
  console.error("");
  console.error("Fix the blocking item above, then rerun pnpm preflight:alpha.");
  console.error(
    "For local PostgreSQL setup, run pnpm setup:alpha-db after PostgreSQL is installed and started.",
  );
  process.exit(1);
}
