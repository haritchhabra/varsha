#!/usr/bin/env bash
# Hot-reload dashboard on http://localhost:5173 (reads frontend/public/data)
set -euo pipefail
cd "$(dirname "$0")/frontend" && npx vite --port 5173
