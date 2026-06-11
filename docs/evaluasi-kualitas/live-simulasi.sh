#!/usr/bin/env bash
# Wrapper simulasi live — lihat live-simulasi.mjs
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
if [[ ! -d node_modules ]]; then
  echo "Menginstall dependency mqtt…"
  npm install --silent
fi
exec node live-simulasi.mjs "$@"
