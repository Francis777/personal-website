import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  build: {
    outDir: '../../_site/bgr/wine',
    emptyOutDir: true,
  },
  plugins: [react()],
})
