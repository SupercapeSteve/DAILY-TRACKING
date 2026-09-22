// Dev-preview config ONLY. Swaps the real data layer for mock/ so the screens
// can be reviewed without a live Supabase project.
//   npx vite --config vite.config.mock.ts
// The real `npm run build` never reads this file.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: [
      { find: /^(\.\.\/)+lib\/api$/, replacement: here('./mock/api.ts') },
      { find: /^(\.\.\/)+lib\/auth$/, replacement: here('./mock/auth.tsx') },
      { find: /^\.\/lib\/auth$/, replacement: here('./mock/auth.tsx') },
      { find: /^\.\/lib\/api$/, replacement: here('./mock/api.ts') },
    ],
  },
  server: { port: 5199, host: true },
})
