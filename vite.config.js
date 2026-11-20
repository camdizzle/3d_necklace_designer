import { defineConfig } from 'vite'
import { fileURLToPath } from 'url'

// The designer's source page is src/design/index.html and builds to
// dist/design/index.html, served at /design/.
//
// It deliberately does not live at <project>/design/index.html: on hosts
// whose web server serves the project folder directly (a Plesk document
// root left at the project folder), that file would be sent for /design/
// instead of the built page, and the unbuilt page cannot run.
//
// The landing, gallery, search and legal pages are rendered by Express
// (api/pages.js), so `npm run dev` serves only the designer: open /design/.
const r = (p) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  root: r('./src'),
  publicDir: r('./public'),
  assetsInclude: ['**/*.stl'],
  server: {
    fs: { strict: false },
    open: '/design/'
  },
  build: {
    outDir: r('./dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: r('./src/design/index.html')
    }
  }
})
