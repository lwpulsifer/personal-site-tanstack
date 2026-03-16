#!/usr/bin/env bash
set -euo pipefail

bash scripts/supabase-env-file.sh

# Kill local ports to avoid collisions when restarting.
lsof -ti :3000 | xargs kill 2>/dev/null || true

exec ./node_modules/.bin/dotenv -e .env.local -e .env.supabase -o -- ./node_modules/.bin/vite dev --port 3000

