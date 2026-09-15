import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  // Fail loudly if 5173 is taken: the API's CORS allow-list names exactly this origin.
  server: { port: 5173, strictPort: true },
  test: { include: ['src/**/*.test.{ts,tsx}'] },
})
