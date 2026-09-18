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
      'beige-poems-joke.loca.lt',             
      '.loca.lt',                             
      'mydgu-132-191-0-241.free.pinggy.net',  
      '.pinggy.net',                          
      '.pinggy.link',                         
      '.pinggy-free.link'                     
    ],
    proxy: {
      // Este es el puente mágico hacia tu servidor Node.js
      '/api': {
        target: 'https://9tn78aefic.execute-api.us-east-1.amazonaws.com', // 🚀 CORREGIDO: Sin espacios
        changeOrigin: true, // 🚀 CORREGIDO: Disfraza la cabecera Host
        secure: false,      // 🚀 AÑADIDO: Evita bloqueos SSL
      }
    }
  }
})