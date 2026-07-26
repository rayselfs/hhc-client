import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'out/renderer'
  },
  preview: {
    host: '127.0.0.1',
    port: 5173
  }
})
