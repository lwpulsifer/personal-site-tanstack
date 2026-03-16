# Liam Pulsifer

This is my personal website, made with Tanstack Start, Typescript, Tailwind CSS, and Webpack 5. This site is under active development and may have crippling bugs. View at your own risk!

## Local Supabase + E2E

This repo can run against a local Supabase instance (Supabase CLI + Docker Desktop).

- Start local dev server with Supabase env: `npm run dev:local`
- Generate `.env.supabase` only (for tests): `npm run supabase:env`
- Reset local DB (migrations + seed): `npm run db:reset`
- Run Playwright e2e against local Supabase: `npm run e2e:local`

Notes:
- Docker Desktop must be running for `supabase start`.
- `.env.supabase` is generated locally and is gitignored.
