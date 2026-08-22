import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
    __ONEDRIVE_CLIENT_ID__: JSON.stringify('4f4c2f2c-8f2a-4c4b-9d2e-8c3a7d638c02'),
    __HHC_ACCOUNT_ORIGIN__: JSON.stringify('https://account.alive.org.tw'),
    __HHC_ASSET_ORIGIN__: JSON.stringify('https://www.alive.org.tw'),
    __BIBLE_API_HOST__: JSON.stringify('https://www.alive.org.tw'),
    __BIBLE_API_V1_PREFIX__: JSON.stringify('/api/bible/v1'),
    __BIBLE_API_V2_PREFIX__: JSON.stringify('/api/bible/v2')
  },
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/renderer/src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: [
        'src/renderer/src/**/*.{ts,tsx}',
        'src/shared/**/*.ts',
        'src/main/**/*.ts',
        'src/preload/**/*.ts'
      ],
      exclude: ['**/*.d.ts', '**/*.test.*', '**/*.spec.*', '**/test/**']
    }
  }
})
