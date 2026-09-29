#!/usr/bin/env bash
# Train + verify + export (first run only, ~5 min), build the dashboard, serve everything on :8000
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f frontend/public/data/meta.json ] || [ "${1:-}" = "--retrain" ]; then
  echo "▸ running ML pipeline (simulate → classify → correct → calibrate → verify → export)"
  (cd backend && .venv/bin/python -u run_pipeline.py)
fi
echo "▸ building dashboard"
(cd frontend && npx vite build --logLevel warn)
echo "▸ serving on http://localhost:8000  (API docs: http://localhost:8000/docs)"
cd backend && .venv/bin/python server.py
