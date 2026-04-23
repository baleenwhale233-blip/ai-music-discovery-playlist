#!/bin/zsh

set -euo pipefail

PROJECT_DIR="/Users/yang/Documents/New project/ai-music-discovery-playlist"
API_PID_FILE=".run/local-audio-api.pid"
ADMIN_PID_FILE=".run/local-audio-admin.pid"
API_PORT="4000"
ADMIN_PORT="3000"

echo ""
echo "AI Music Discovery: Stop Local Audio Experiment"
echo ""

cd "${PROJECT_DIR}"

stop_pid_file() {
  local label="$1"
  local file="$2"

  if [ ! -f "${file}" ]; then
    echo "${label}: no pid file found."
    return
  fi

  local pid
  pid=$(cat "${file}")

  if kill -0 "${pid}" >/dev/null 2>&1; then
    kill "${pid}" >/dev/null 2>&1 || true
    echo "${label}: stopped pid ${pid}"
  else
    echo "${label}: pid ${pid} is not running"
  fi

  rm -f "${file}"
}

stop_pid_file "API" "${API_PID_FILE}"
stop_pid_file "Admin" "${ADMIN_PID_FILE}"

stop_port() {
  local port="$1"
  local pids
  pids=$(lsof -ti "tcp:${port}" 2>/dev/null || true)

  if [ -n "${pids}" ]; then
    kill ${pids} >/dev/null 2>&1 || true
    sleep 1
    pids=$(lsof -ti "tcp:${port}" 2>/dev/null || true)
    if [ -n "${pids}" ]; then
      kill -9 ${pids} >/dev/null 2>&1 || true
    fi
    echo "Port ${port}: cleared"
  else
    echo "Port ${port}: no listener"
  fi
}

stop_port "${API_PORT}"
stop_port "${ADMIN_PORT}"

echo ""
echo "Done."
