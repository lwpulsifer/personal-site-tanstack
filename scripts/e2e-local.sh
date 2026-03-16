#!/usr/bin/env bash
set -euo pipefail

# Ensure local Supabase is running and env file exists
bash scripts/supabase-env-file.sh

# Reset DB to a clean, seeded state for deterministic e2e runs.
# Supabase CLI can occasionally hit transient 502s while containers restart; retry a few times.
for i in $(seq 1 3); do
  if supabase db reset --local; then
    break
  fi
  echo "supabase db reset failed (attempt $i). Waiting and retrying..."
  sleep 5
  if [ "$i" -eq 2 ]; then
    echo "Restarting Supabase..."
    supabase stop || true
    supabase start
  fi
  if [ "$i" -eq 3 ]; then
    echo "ERROR: supabase db reset failed after retries."
    exit 1
  fi
done

# Run Playwright with the same env as local dev
exec ./node_modules/.bin/dotenv -e .env.local -e .env.supabase -o -- ./node_modules/.bin/playwright test
