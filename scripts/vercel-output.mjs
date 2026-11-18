// Packages the Solid build (dist/) as a Vercel "Build Output API v3" bundle
// (.vercel/output), which is how Vercel runs a custom server with no framework
// preset: static files go to the CDN, everything else to one Node function.
//
//   dist/client      -> .vercel/output/static            (served by Vercel's CDN)
//   dist/server      -> .vercel/output/functions/index.func (SSR + server functions)
//
// The Solid server build leaves package imports (solid-js, @supabase/ssr, ...)
// external, so @vercel/nft traces exactly the node_modules files it needs and
// those are copied next to the function. Runs after `vite build` in CI/Vercel
// (npm run build does this only when VERCEL is set, or with --force).
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { nodeFileTrace } from '@vercel/nft'

if (!process.env.VERCEL && !process.argv.includes('--force')) {
  console.log('[vercel-output] not on Vercel; skipping (pass --force to package anyway)')
  process.exit(0)
}

const root = process.cwd()
const out = path.join(root, '.vercel', 'output')
const func = path.join(out, 'functions', 'index.func')

rmSync(out, { recursive: true, force: true })
mkdirSync(func, { recursive: true })

// 1. Static assets (skip the precompressed copies; Vercel compresses itself).
cpSync(path.join(root, 'dist', 'client'), path.join(out, 'static'), {
  recursive: true,
  filter: (src) => !/\.(br|gz)$/.test(src),
})

// 2. Function code: only the server entry and its chunks. dist/server also holds
// copies of public/ files for the standalone Node server; the CDN serves those.
const serverDir = path.join(root, 'dist', 'server')
const serverFiles = ['server.js', 'node.js']
for (const file of serverFiles) {
  cpSync(path.join(serverDir, file), path.join(func, 'dist', 'server', file))
}
cpSync(path.join(serverDir, 'assets'), path.join(func, 'dist', 'server', 'assets'), { recursive: true })

// 3. Dependencies, traced from the entry points.
const entries = [
  ...serverFiles.map((f) => path.join('dist', 'server', f)),
  ...readdirSync(path.join(serverDir, 'assets')).map((f) => path.join('dist', 'server', 'assets', f)),
]
const { fileList, warnings } = await nodeFileTrace(entries, { base: root, processCwd: root })
let copied = 0
for (const file of fileList) {
  if (!file.startsWith('node_modules/')) continue
  cpSync(path.join(root, file), path.join(func, file), { dereference: true })
  copied++
}
for (const w of warnings) console.warn('[vercel-output] nft warning:', w.message)

// 4. The handler: the build's Node listener, minus its own static-file serving.
writeFileSync(
  path.join(func, 'index.mjs'),
  "import { createListener } from './dist/server/node.js'\nexport default createListener({ static: false })\n",
)
writeFileSync(path.join(func, 'package.json'), JSON.stringify({ type: 'module' }))
writeFileSync(
  path.join(func, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      supportsResponseStreaming: true,
    },
    null,
    2,
  ),
)

// 5. Routing: hashed assets are immutable; real static files win; the rest is SSR.
writeFileSync(
  path.join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        {
          src: '^/assets/(.*)$',
          headers: { 'cache-control': 'public, max-age=31536000, immutable' },
          continue: true,
        },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/index' },
      ],
    },
    null,
    2,
  ),
)

console.log(`[vercel-output] wrote .vercel/output (${copied} dependency files traced)`)
