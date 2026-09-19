import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
