#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== OnePilot Setup ==="
echo ""

# --- Backend ---
echo ">> Setting up backend..."
cd "$ROOT_DIR/backend"

if ! command -v uv &>/dev/null; then
  echo "ERROR: 'uv' is not installed. Install it from https://docs.astral.sh/uv/ and try again."
  exit 1
fi

uv venv
uv pip install -r requirements.txt
uv run python -m app.seed
echo "   Backend ready."
echo "   Start with:  cd backend && uv run python -m app"
echo ""

# --- Frontend ---
echo ">> Setting up frontend..."
cd "$ROOT_DIR/frontend"

if ! command -v npm &>/dev/null; then
  echo "ERROR: 'npm' is not installed. Install Node.js and try again."
  exit 1
fi

npm ci
echo "   Frontend ready."
echo "   Start with:  cd frontend && npm run dev"
echo ""

echo "=== Done ==="
echo ""
echo "Quick start:"
echo "  1. Terminal 1:  cd backend  &&  uv run python -m app"
echo "  2. Terminal 2:  cd frontend &&  npm run dev"
echo "  3. Open http://localhost:3000"
echo "  4. Login: admin@onecorestack.com / password"
