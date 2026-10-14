import { defineConfig } from 'vite'

// Vercel injects VITE_VERCEL_* build metadata (author name, commit message,
// branch, sha, deployment URL) into the BUILD process env. They are not app
// config — strip them here so they can never reach `import.meta.env` and get
// inlined into the public client bundle.
for (const key of Object.keys(process.env)) {
  if (key.startsWith('VITE_VERCEL_')) delete process.env[key]
}

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
