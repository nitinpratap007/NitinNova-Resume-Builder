import { defineConfig } from 'vite'

// Standalone WEB version config — completely separate from frontend/ (Android).
// base './' makes every asset reference relative so the build works from any
// static host AND from a sub-path (e.g. GitHub Pages /repo-name/).
export default defineConfig({
  base: './',
  server: { port: 5174, strictPort: false },
  preview: { port: 4174, strictPort: true },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0, // keep the pdf.js worker as a real file (offline PDF import)
    chunkSizeWarningLimit: 1600,
  },
})
