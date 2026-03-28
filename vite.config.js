import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  publicDir: 'public',
  assetsInclude: ['**/*.stl'],
  server: {
    fs: { strict: false }
  },
  plugins: [{
    name: 'serve-root-stl',
    configureServer(server) {
      server.middlewares.use('/ChainMakerChain.stl', (req, res) => {
        const stlPath = path.resolve(__dirname, 'ChainMakerChain.stl')
        res.setHeader('Content-Type', 'application/octet-stream')
        fs.createReadStream(stlPath).pipe(res)
      })
    },
    closeBundle() {
      const src = path.resolve(__dirname, 'ChainMakerChain.stl')
      const dest = path.resolve(__dirname, 'dist', 'ChainMakerChain.stl')
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest)
      }
    }
  }],
  build: {
    outDir: 'dist'
  }
})
