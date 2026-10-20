#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if command -v node >/dev/null 2>&1; then
  NODE="$(command -v node)"
else
  echo "Node.js 20 or newer is needed. Install it, then run this launcher again."
  exit 1
fi

echo "Open http://127.0.0.1:${PORT:-8791} in your browser."
exec "$NODE" server.mjs
