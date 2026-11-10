import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

// Multi-page build so URLs stay the same as the old static site on GitHub Pages.
export default defineConfig({
  base: '/system-design/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  build: {
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        loadBalancer: resolve(import.meta.dirname, 'concepts/load-balancer.html'),
      },
    },
  },
})
