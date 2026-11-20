import { defineConfig } from 'vite'

// The designer lives at /design/ (design/index.html). The landing,
// gallery, search and legal pages are rendered by Express (api/pages.js),
// so `npm run dev` serves only the designer: open /design/.
export default defineConfig({
  publicDir: 'public',
  assetsInclude: ['**/*.stl'],
  server: {
    fs: { strict: false },
    open: '/design/'
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'design/index.html'
    }
  }
})
