import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(),tailwindcss(),],
  server: {
    // `npm run dev:api` serves the same handler Vercel runs
    proxy: { '/api': 'http://localhost:3001' },
  },
})
