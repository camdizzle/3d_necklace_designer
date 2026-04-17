import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: 'public',
  assetsInclude: ['**/*.stl'],
  server: {
    fs: { strict: false }
  },
  build: {
    outDir: 'dist'
  }
})
