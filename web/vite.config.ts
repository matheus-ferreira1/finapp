import { writeFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Vite empties dist on every build, but the Go binary embeds that folder and
// needs at least one tracked file in it to compile on a clean checkout.
const keepDistPlaceholder = {
  name: 'keep-dist-placeholder',
  apply: 'build' as const,
  closeBundle() {
    writeFileSync('dist/.gitkeep', '')
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), keepDistPlaceholder],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8080',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
})
