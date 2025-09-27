#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Desktop and try again." >&2
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

for port in {5000..5050}; do
  if ! lsof -i TCP:"$port" >/dev/null 2>&1; then
    export HOST_PORT="$port"
    echo "Starting LibreTranslate server (http://localhost:${HOST_PORT}/translate)..."
    cd "$SCRIPT_DIR"
    docker compose up
    exit $?
  fi
done

echo "No free port found between 5000 and 5050." >&2
exit 1

