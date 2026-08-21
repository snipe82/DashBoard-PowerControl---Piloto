import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // 🚀 INYECCIÓN DE PERMISOS PARA TÚNELES EXTERNOS
    allowedHosts: [
      'beige-poems-joke.loca.lt',             // Localtunnel anterior
      '.loca.lt',                             // Comodín Localtunnel
      'mydgu-132-191-0-241.free.pinggy.net',  // Permite el túnel Pinggy actual
      '.pinggy.net',                          // Comodín para futuros túneles Pinggy (.net)
      '.pinggy.link',                         // Comodín para futuros túneles Pinggy (.link)
      '.pinggy-free.link'                     // Comodín alternativo de Pinggy gratuito
    ],
    proxy: {
      // Este es el puente mágico hacia tu servidor Node.js
      '/api': {
        target: 'http://localhost:4521',
        changeOrigin: true,
      }
    }
  }
})