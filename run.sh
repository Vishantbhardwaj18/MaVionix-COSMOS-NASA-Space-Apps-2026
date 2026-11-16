#!/usr/bin/env bash
# Start COSMOS on this computer: API on :8000, website on :3000.
#   ./run.sh          live mode (asks NASA/IPAC IRSA and JPL; needs internet)
#   ./run.sh demo     sample mode (no internet needed; everything is labelled synthetic)
#   ./run.sh check    test that this computer can reach the SPHEREx archive, then exit
set -euo pipefail
cd "$(dirname "$0")"
MODE="${1:-live}"
PY="${PYTHON:-python3}"
command -v "$PY" >/dev/null || { echo "Python 3.11+ is required: https://www.python.org/downloads/"; exit 1; }
command -v node >/dev/null || { echo "Node.js 20+ is required: https://nodejs.org/"; exit 1; }

if [ ! -d backend/.venv ]; then
  echo "== Setting up Python (first run only) =="
  "$PY" -m venv backend/.venv
  backend/.venv/bin/pip install --quiet --upgrade pip
  backend/.venv/bin/pip install --quiet -r backend/requirements.txt
fi
if [ "$MODE" = "check" ]; then
  cd backend && exec .venv/bin/python scripts/verify_irsa.py 270 66.56
fi
if [ ! -d frontend/node_modules ]; then
  echo "== Installing the website's packages (first run only) =="
  (cd frontend && npm ci --no-audit --no-fund)
fi
if [ ! -d frontend/.next ] || [ -n "$(find frontend/src frontend/package.json -newer frontend/.next/BUILD_ID 2>/dev/null | head -1)" ]; then
  echo "== Building the website =="
  (cd frontend && npm run build)
fi

[ "$MODE" = "demo" ] && export COSMOS_MODE=demo || export COSMOS_MODE=live
echo "== Starting the API in $COSMOS_MODE mode on http://localhost:8000 =="
(cd backend && exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000) &
API_PID=$!
trap 'kill $API_PID 2>/dev/null || true' EXIT INT TERM
echo "== Starting the website on http://localhost:3000 =="
echo "   Open http://localhost:3000 in a browser. Press Ctrl+C here to stop both."
cd frontend && COSMOS_API_URL=http://localhost:8000 npx next start -p 3000
