#!/usr/bin/env bash
# One-time setup: Python env + frontend deps. Works on macOS / Linux (Windows: see README).
set -euo pipefail
cd "$(dirname "$0")"
echo "▸ backend: creating virtualenv"
if command -v uv >/dev/null 2>&1; then
  uv venv --python 3.12 backend/.venv && uv pip install --python backend/.venv/bin/python -r backend/requirements.txt
else
  python3 -m venv backend/.venv && backend/.venv/bin/pip install -q -r backend/requirements.txt
fi
echo "▸ frontend: npm install"
(cd frontend && npm install --silent)
echo "✓ setup done. Next: ./run.sh"
