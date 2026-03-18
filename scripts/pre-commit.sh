#!/usr/bin/env bash
# Pre-commit hook: regenerate Supabase types and fail if they've drifted.
# Install with: npm run prepare
# Or manually: ln -sf ../../scripts/pre-commit.sh .git/hooks/pre-commit

set -euo pipefail

TYPES_FILE="src/lib/database.types.ts"

# Only run if the local Supabase instance is reachable.
if ! supabase status &>/dev/null; then
  echo "⚠  Local Supabase is not running — skipping type generation check."
  exit 0
fi

# Generate fresh types into a temp file and compare.
TEMP=$(mktemp)
trap 'rm -f "$TEMP"' EXIT

supabase gen types typescript --local 2>/dev/null > "$TEMP"

if ! diff -q "$TYPES_FILE" "$TEMP" &>/dev/null; then
  echo "❌ database.types.ts is out of date with local schema."
  echo "   Run: npm run db:types"
  echo "   Then stage the updated file and commit again."
  # Auto-update the file so the developer just needs to stage it.
  cp "$TEMP" "$TYPES_FILE"
  exit 1
fi

echo "✓ database.types.ts is up to date."
