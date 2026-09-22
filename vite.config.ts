import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative base means the built site works whether it is served from the
  // root of a domain or from a subfolder. Routing is hash-based, so this is safe.
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 5173,
    host: true, // lets you open the dev server from your phone on the same wifi
  },
})
