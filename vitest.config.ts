import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [tsconfigPaths(), viteReact()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
})
