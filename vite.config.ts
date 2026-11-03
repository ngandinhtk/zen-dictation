import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        privacy: fileURLToPath(new URL('./privacy.html', import.meta.url)),
      },
    },
  },
  server: {
    allowedHosts: ['massager-chemo-cofounder.ngrok-free.dev'],
    proxy: {
      '/api': 'http://localhost:3002',
    },
  },
  preview: {
    proxy: {
      '/api': 'http://localhost:3002',
    },
  },
})
