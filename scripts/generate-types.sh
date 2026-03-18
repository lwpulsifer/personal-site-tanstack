#!/usr/bin/env bash
# Generate Supabase database types from the local instance.
# Requires: Docker running + `supabase start` (or `supabase db reset --local`).

set -euo pipefail

TYPES_FILE="src/lib/database.types.ts"

# Check that the local Supabase instance is reachable.
if ! supabase status &>/dev/null; then
  echo "⚠  Local Supabase is not running — skipping type generation."
  echo "   Start it with: supabase start"
  exit 0
fi

echo "Generating Supabase types → $TYPES_FILE"
supabase gen types typescript --local 2>/dev/null > "$TYPES_FILE"
echo "Done."
