import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

// Served from https://<user>.github.io/retirement-planner/ on GitHub Pages.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/retirement-planner/',
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 1000 },
  test: { environment: 'node' },
})
