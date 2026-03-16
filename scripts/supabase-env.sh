#!/usr/bin/env bash
set -euo pipefail

# Start supabase if not fully running
STATUS=$(supabase status -o env 2>/dev/null || true)
if ! echo "$STATUS" | grep -q '^API_URL='; then
  echo "Supabase not fully running — starting..."
  supabase start
  STATUS=$(supabase status -o env 2>/dev/null || true)
fi

# Wait up to 30s for all services to be ready
for i in $(seq 1 15); do
  if echo "$STATUS" | grep -q '^API_URL=' && echo "$STATUS" | grep -q '^ANON_KEY=' && echo "$STATUS" | grep -q '^SERVICE_ROLE_KEY='; then
    break
  fi
  echo "Waiting for Supabase services... ($i)"
  sleep 2
  STATUS=$(supabase status -o env 2>/dev/null || true)
done

API_URL=$(echo "$STATUS" | grep '^API_URL=' | cut -d'"' -f2)
ANON_KEY=$(echo "$STATUS" | grep '^ANON_KEY=' | cut -d'"' -f2)
SERVICE_ROLE_KEY=$(echo "$STATUS" | grep '^SERVICE_ROLE_KEY=' | cut -d'"' -f2)

if [ -z "$API_URL" ] || [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "ERROR: Supabase services not ready. Try: supabase stop && supabase start"
  exit 1
fi

cat > .env.supabase <<EOF
SUPABASE_URL=$API_URL
SUPABASE_KEY=$SERVICE_ROLE_KEY
VITE_SUPABASE_URL=$API_URL
VITE_SUPABASE_ANON_KEY=$ANON_KEY
EOF

echo "Wrote local Supabase credentials to .env.supabase"

lsof -ti :3000 | xargs kill 2>/dev/null || true
lsof -ti :42069 | xargs kill 2>/dev/null || true

exec ./node_modules/.bin/dotenv -e .env.local -e .env.supabase -o -- ./node_modules/.bin/vite dev --port 3000
