import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // Este es el puente mágico hacia tu servidor Node.js
      '/api': {
        target: 'http://localhost:4521',
        changeOrigin: true,
      }
    }
  }
})