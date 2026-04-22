#!/bin/zsh

set -euo pipefail

PROJECT_DIR="/Users/yang/Documents/New project/ai-music-discovery-playlist"
PORT="8081"
CHECK_ONLY="${1:-}"

echo ""
echo "AI Music Discovery: Mobile Web Preview"
echo "Project: ${PROJECT_DIR}"
echo ""

cd "${PROJECT_DIR}"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Error: pnpm not found."
  echo "Please install pnpm first, then run this script again."
  echo ""
  read -r "?Press Enter to close..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "node_modules not found. Running pnpm install..."
  pnpm install
fi

if [ ! -f "apps/mobile/package.json" ]; then
  echo "Error: apps/mobile/package.json not found."
  echo "The project structure looks incomplete."
  echo ""
  read -r "?Press Enter to close..."
  exit 1
fi

if [ "${CHECK_ONLY}" = "--check" ]; then
  echo "Environment check passed."
  echo "pnpm found, project found, mobile app found."
  exit 0
fi

(
  sleep 5
  open "http://localhost:${PORT}" >/dev/null 2>&1 || true
) &

echo "Starting Expo Web preview on http://localhost:${PORT}"
echo "Keep this terminal window open while previewing."
echo ""

pnpm --filter @ai-music-playlist/mobile exec expo start --web --port "${PORT}"
