import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@web': fileURLToPath(new URL('./src', import.meta.url)),
      '@ecommerce/shared': fileURLToPath(new URL('../packages/shared/src', import.meta.url)),
    },
  },
})
