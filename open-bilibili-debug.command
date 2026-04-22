#!/bin/zsh

set -euo pipefail

PROJECT_DIR="/Users/yang/Documents/New project/ai-music-discovery-playlist"
API_PORT="4000"
ADMIN_PORT="3000"
HEALTH_URL="http://127.0.0.1:${API_PORT}/api/v1/health"
DEBUG_URL="http://127.0.0.1:${ADMIN_PORT}/debug/bilibili"
EXPECTED_MARKER="Audio-first Debug v2"
CHECK_ONLY="${1:-}"

LOG_DIR=".logs"
RUN_DIR=".run"
API_LOG="${LOG_DIR}/bilibili-debug-api.log"
ADMIN_LOG="${LOG_DIR}/bilibili-debug-admin.log"
API_PID_FILE="${RUN_DIR}/bilibili-debug-api.pid"
ADMIN_PID_FILE="${RUN_DIR}/bilibili-debug-admin.pid"

echo ""
echo "AI Music Discovery: Bilibili Debug Launcher"
echo "Project: ${PROJECT_DIR}"
echo ""

cd "${PROJECT_DIR}"
mkdir -p "${LOG_DIR}" "${RUN_DIR}"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Error: pnpm not found."
  echo "Please install pnpm first."
  echo ""
  read -r "?Press Enter to close..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "node_modules not found. Running pnpm install..."
  pnpm install
fi

if [ ! -f "apps/api/package.json" ] || [ ! -f "apps/admin/package.json" ]; then
  echo "Error: api/admin apps not found."
  echo ""
  read -r "?Press Enter to close..."
  exit 1
fi

if [ "${CHECK_ONLY}" = "--check" ]; then
  echo "Environment check passed."
  echo "pnpm found, project found, api/admin apps found."
  exit 0
fi

stop_port() {
  local port="$1"
  local pids
  pids=$(lsof -ti "tcp:${port}" 2>/dev/null || true)
  if [ -n "${pids}" ]; then
    echo "Stopping processes on port ${port}: ${pids}"
    kill ${pids} >/dev/null 2>&1 || true
    sleep 1
    pids=$(lsof -ti "tcp:${port}" 2>/dev/null || true)
    if [ -n "${pids}" ]; then
      echo "Force stopping remaining processes on port ${port}: ${pids}"
      kill -9 ${pids} >/dev/null 2>&1 || true
      sleep 1
    fi
  fi
}

cleanup_previous_state() {
  rm -f "${API_PID_FILE}" "${ADMIN_PID_FILE}"
  rm -f "${API_LOG}" "${ADMIN_LOG}"
  rm -rf apps/admin/.next
}

wait_for_http_ok() {
  local url="$1"
  local tries="$2"
  local label="$3"

  for _ in $(seq 1 "${tries}"); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "Error: ${label} did not become ready in time."
  return 1
}

wait_for_marker() {
  local url="$1"
  local marker="$2"
  local tries="$3"

  for _ in $(seq 1 "${tries}"); do
    if curl -fsS "${url}" 2>/dev/null | grep -F "${marker}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "Error: admin page is up, but expected marker was not found: ${marker}"
  return 1
}

show_logs_and_exit() {
  echo ""
  echo "API log tail:"
  tail -n 60 "${API_LOG}" 2>/dev/null || true
  echo ""
  echo "Admin log tail:"
  tail -n 80 "${ADMIN_LOG}" 2>/dev/null || true
  echo ""
  read -r "?Press Enter to close..."
  exit 1
}

echo "Stopping previous services on ports ${API_PORT} and ${ADMIN_PORT}..."
stop_port "${API_PORT}"
stop_port "${ADMIN_PORT}"
cleanup_previous_state

echo "Building shared packages, API, and admin..."
pnpm --filter @ai-music-playlist/config build
pnpm --filter @ai-music-playlist/types build
pnpm --filter @ai-music-playlist/api-contract build
pnpm --filter @ai-music-playlist/api build
pnpm --filter @ai-music-playlist/admin build

echo "Starting API on port ${API_PORT}..."
nohup pnpm --filter @ai-music-playlist/api start > "${API_LOG}" 2>&1 &
echo $! > "${API_PID_FILE}"

if ! wait_for_http_ok "${HEALTH_URL}" 30 "API health endpoint"; then
  show_logs_and_exit
fi

echo "Starting admin on port ${ADMIN_PORT}..."
nohup env PORT="${ADMIN_PORT}" pnpm --filter @ai-music-playlist/admin start > "${ADMIN_LOG}" 2>&1 &
echo $! > "${ADMIN_PID_FILE}"

if ! wait_for_http_ok "${DEBUG_URL}" 30 "admin debug page"; then
  show_logs_and_exit
fi

if ! wait_for_marker "${DEBUG_URL}" "${EXPECTED_MARKER}" 10; then
  show_logs_and_exit
fi

echo ""
echo "API log:   ${PROJECT_DIR}/${API_LOG}"
echo "Admin log: ${PROJECT_DIR}/${ADMIN_LOG}"
echo "Opening ${DEBUG_URL}"
echo ""

open "${DEBUG_URL}" >/dev/null 2>&1 || true

echo "Bilibili debug page should now be available."
echo "Marker confirmed: ${EXPECTED_MARKER}"
echo "Use stop-bilibili-debug.command to stop the services later."
