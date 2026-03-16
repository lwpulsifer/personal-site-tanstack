#!/usr/bin/env bash
set -euo pipefail

supabase start

# Capture env output, stripping stderr (upgrade notices etc.)
STATUS=$(supabase status -o env 2>/dev/null)

API_URL=$(echo "$STATUS" | grep '^API_URL=' | cut -d'"' -f2)
ANON_KEY=$(echo "$STATUS" | grep '^ANON_KEY=' | cut -d'"' -f2)
SERVICE_ROLE_KEY=$(echo "$STATUS" | grep '^SERVICE_ROLE_KEY=' | cut -d'"' -f2)

if [ -z "$API_URL" ] || [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "Failed to parse Supabase credentials"
  exit 1
fi

cat > .env.supabase <<EOF
SUPABASE_URL=$API_URL
SUPABASE_KEY=$SERVICE_ROLE_KEY
VITE_SUPABASE_URL=$API_URL
VITE_SUPABASE_ANON_KEY=$ANON_KEY
EOF

echo "Wrote local Supabase credentials to .env.supabase"

npx dotenv -e .env.local -e .env.supabase -o -- vite dev --port 3000
