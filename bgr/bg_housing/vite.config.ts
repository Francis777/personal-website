import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  build: {
    outDir: '../../_site/bgr/housing',
    emptyOutDir: true,
  },
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:4173',
    },
  },
})
