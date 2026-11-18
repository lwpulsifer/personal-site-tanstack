import solid from '@solidjs/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { fileRoutes } from 'filesystem-routing/vite'
import { defineConfig } from 'vitest/config'

// Solid 2.0 app. The previous TanStack Start (React) version lives in ./react
// with its own Vite config: both frameworks want to own the JSX transform.
export default defineConfig({
  plugins: [
    tailwindcss(),
    solid({
      // Turnkey streaming SSR: entries are generated around src/App.tsx,
      // wrapped in src/Document.tsx.
      start: { middleware: './src/middleware.ts', nodeServer: true },
      ssr: true,
      serverFunctions: { serverSetup: './src/server-config.ts' },
      // Also compile the `?pick=` route modules fileRoutes emits.
      extensions: ['.jsx', '.tsx'],
    }),
    // httpMethods: also scan route modules for GET/POST exports (API routes).
    fileRoutes({ httpMethods: true, types: true }),
  ],
  server: { port: 3000 },
  build: { target: 'esnext', assetsInlineLimit: 0 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
