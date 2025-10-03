import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import vuetify from 'vite-plugin-vuetify'

import electron from 'vite-plugin-electron/simple'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    vue(),
    vueDevTools(),
    vuetify({ autoImport: true }),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          // 如果你的主程序需要載入 Vue 3 渲染器，則這個設定很重要
          build: {
            rollupOptions: {
              external: ['electron'], // 排除打包 electron 模組
            },
          },
        },
      },
      // 預加載腳本（preload script）
      preload: {
        input: 'electron/preload.ts',
      },
      // 額外的 Electron 相關腳本
      renderer: {},
    }),
  ],
  build: {
    outDir: 'dist-electron/renderer',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
