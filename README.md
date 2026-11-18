# Liam Pulsifer

My personal website, built with **Solid 2.0** (SSR with streaming), TypeScript, Tailwind CSS, and Supabase. This site is under active development and may have crippling bugs. View at your own risk!

The previous version, built with TanStack Start and React, lives in [`react/`](./react). Both apps share the Supabase schema (`supabase/`), the Playwright suite (`e2e/`), `public/`, and `scripts/`.

## Layout

| Path | What |
|---|---|
| `src/`, `package.json`, `vite.config.ts` | The Solid 2.0 app (the root package) |
| `react/` | The TanStack Start app, with its own `package.json` (`cd react && npm ci`) |
| `e2e/` | Playwright suite, run against either app |
| `supabase/` | Migrations and seed data |
| `src/lib/database.types.ts` | Generated DB types (`react/` symlinks to this file) |

## Develop

```bash
nvm use 22                       # Solid 2 packages need Node >= 22.12
npm install
npm run dev                      # http://localhost:3000 (loads .env.local)
npm test                         # vitest (pure logic)
npm run typecheck
npm run build && npm start       # production server (PORT picks the port)
```

## Local Supabase + E2E

This repo can run against a local Supabase instance (Supabase CLI + Docker Desktop).

- Start local dev server with Supabase env: `npm run dev:local`
- Generate `.env.supabase` only (for tests): `npm run supabase:env`
- Reset local DB (migrations + seed): `npm run db:reset`
- Run Playwright e2e against local Supabase: `npm run e2e:local`
- Run the same suite against the React app: `E2E_TARGET=react npm run e2e:local` (it starts `react/` on port 3001)

Notes:
- Docker Desktop must be running for `supabase start`.
- `.env.supabase` is generated locally and is gitignored.
- `e2e/tests/validation.spec.ts` reads Vite's transformed modules, so it only runs against the dev server (skipped in CI and for the React target).

## Deploying to Vercel

`vercel.json` sets no framework and runs `npm run build`. On Vercel (`VERCEL=1`), `scripts/vercel-output.mjs` packages the build as a [Build Output API](https://vercel.com/docs/build-output-api/v3) bundle in `.vercel/output`:

- `dist/client` becomes the static files, served by Vercel's CDN;
- `dist/server` becomes one Node function (streaming SSR + server functions), with its `node_modules` dependencies traced by `@vercel/nft`.

Environment variables, as for the React app: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must exist **at build time** (Vite bakes `VITE_*` values into the client); `SUPABASE_URL`, `SUPABASE_KEY` and the Spotify variables are read at runtime. Run `VERCEL=1 npm run build` (or `node scripts/vercel-output.mjs --force` after a build) to produce the bundle locally.

## How the Solid app differs from the React app

- **Reads** are `query()` from `@solidjs/router`; **mutations** are `'use server'` functions that return `respond(value, { revalidate: [keys] })`. There is no TanStack Query; lists refetch after a mutation rather than being patched in place first.
- **Server-function args are JSON**: no `undefined` values; empty fields are omitted.
- **Input validation** is per function rather than a chained `.inputValidator()`: every server function runs its arguments through `parse(schema, value)` (`src/server/validate.ts`) first, before auth or the database. It throws a plain `Error("Invalid input: …")`, because a `ZodError` can't be encoded by the server-function transport. A new server function that skips `parse()` would be unvalidated, so extend `e2e/tests/validation.spec.ts` with each one.
- **Response headers** (e.g. `cache-control` on posts) live in `src/middleware.ts`; they can't be written from a route once the streamed response head has flushed.
- **Supabase session cookies** written during a streamed render are dropped (the browser client owns its own cookies); mutating server functions still write them.
- **Layout routes need an index child** (`src/routes/books/[bookId]/index.tsx`) or they fall through to the 404.
- **Optimistic navigation** (`src/lib/navigation.ts`): Solid's router holds the old page until the next route's data settles, so the navbar follows the in-flight destination (`isPending` + `latest` on the router location) and shows a progress bar and a dimmed page. Routes `preload` their data on hover/focus, and the footer's page-view count sits in a `<Loading on={path}>` boundary, because otherwise a held transition waits for *every* async read it triggers, including analytics.
- **View transitions** between the book shelf and book page use `src/lib/viewTransition.ts` (Solid's router has no such option).
- **Maps** (`react/src/server/maps.ts`) have no routes in the React app either and were not ported.
- `SOLID_FIXTURES=1 npm run dev` serves fake Spotify tracks for `/fun` (handy when the local refresh token is revoked).
- `src/lib/spotify.ts` is a copy of `react/src/lib/spotify.ts`; `src/styles.css` is likewise a copy of the React app's stylesheet.
