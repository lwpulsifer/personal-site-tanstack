# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on port 3000
npm run build        # Production build (outputs to .output/)
npm test             # Run unit tests (vitest)
npx vitest run src/__tests__/lib/sanitize.test.ts  # Run a single test file
npm run e2e          # Run Playwright e2e tests (needs build first, or dev server running)
npm run check        # Biome lint + format check
npm run lint         # Biome lint only
npm run format       # Biome format only
npm run script <file>  # Run a TS script with dotenv (.env.local) loaded
```

## Code Style

- **Formatter**: Biome with tabs, double quotes for JS/TS
- **Package manager**: npm (not bun/yarn/pnpm)

## Architecture

**TanStack Start** app (React 19 + TanStack Router + TanStack Query) with SSR via Nitro.

### Routing
- File-based routing in `src/routes/` — TanStack Router auto-generates `src/routeTree.gen.ts` (do not edit)
- Root layout in `src/routes/__root.tsx` wraps all pages with `QueryClientProvider`, `AuthProvider`, Header, Footer
- Router config in `src/router.tsx`

### Server Functions
- Server-side logic uses `createServerFn` from `@tanstack/react-start` (in `src/server/`)
- These are RPC-style functions that run on the server but can be called from client components
- Validation uses Zod schemas via `.inputValidator()`

### Data Layer
- **Supabase** as the database/auth backend
- Two Supabase clients:
  - `src/lib/supabase.ts` — `getSupabaseClient()` (service-role, server-only) and `getSupabaseBrowserClient()` (anon, browser)
  - `src/server/supabase.ts` — `getSupabaseServerClient()` (anon + cookie-based session, for auth flows)
- Blog posts use a status system: `posts` table + `post_current_status` view + `post_status_update` table

### Auth
- Supabase Auth with cookie-based sessions
- `src/server/auth.ts` — `getServerUser` server function (used in root loader)
- `src/server/auth.server.ts` — `requireAuth()` guard for admin endpoints
- `src/lib/auth.tsx` — React context (`AuthProvider` / `useAuth`)

### Path Aliases
- `#/*` → `./src/*` (configured in both tsconfig and package.json imports)
- `@/*` → `./src/*` (tsconfig only)

## Testing

### Unit Tests (Vitest)
- Config: `vitest.config.ts` (separate from vite.config.ts to avoid TanStack Start/Nitro plugins)
- Environment: happy-dom (not jsdom)
- Tests in `src/__tests__/{lib,components,server}/`
- Setup file: `src/__tests__/setup.ts`

### E2E Tests (Playwright)
- Tests in `e2e/tests/`
- Runs against localhost:3000 — reuses running dev server locally, starts built server in CI
- Global setup/teardown in `e2e/global-setup.ts` and `e2e/global-teardown.ts`

### Testing Requirements
- **All changes must include tests** — unit tests (Vitest) for logic/components, e2e tests (Playwright) for user-facing flows. Use whichever is more appropriate for the change.
- **Bug fix workflow**: When the user reports a bug, do NOT start by trying to fix it. Instead:
  1. Write a test that reproduces the bug (it should fail).
  2. Use subagents to attempt the fix, verifying success by running the test until it passes.
