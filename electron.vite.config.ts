import { resolve } from 'path'
import { readFileSync } from 'fs'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))

function devCspUnsafeInline(): Plugin {
  return {
    name: 'dev-csp-unsafe-inline',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
    }
  }
}

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version)
    },
    worker: {
      format: 'es'
    },
    plugins: [
      react(),
      tailwindcss(),
      devCspUnsafeInline(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        manifest: {
          name: 'LibrePresenter',
          short_name: 'LibrePresenter',
          description: 'Open-source presentation software for churches and live events',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          icons: [
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          globIgnores: [
            '**/assets/pdf-*.js',
            '**/assets/transformers-*.js',
            '**/assets/microsoft.cognitiveservices.speech.sdk-*.js'
          ],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                url.pathname.endsWith('.woff2') ||
                /\/assets\/(pdf|transformers|microsoft\.cognitiveservices\.speech\.sdk)-/.test(
                  url.pathname
                ),
              handler: 'CacheFirst',
              options: {
                cacheName: 'hhc-optional-assets',
                expiration: {
                  maxEntries: 300,
                  maxAgeSeconds: 60 * 60 * 24 * 30
                }
              }
            }
          ]
        }
      }),
      visualizer({
        filename: 'bundle-report.html',
        open: false,
        gzipSize: true,
        brotliSize: true
      }) as unknown as Plugin
    ],
    server: {
      proxy: {
        '/api/bible': {
          target: 'https://www.alive.org.tw',
          changeOrigin: true,
          secure: true
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'react-vendor'
            }
            if (id.includes('node_modules/@heroui') || id.includes('node_modules/react-aria')) {
              return 'ui-vendor'
            }
            if (id.includes('node_modules/@phosphor-icons')) {
              return 'icons'
            }
            if (
              id.includes('node_modules/@react-aria/color') ||
              id.includes('node_modules/@react-stately/color')
            ) {
              return 'color-picker'
            }
            return undefined
          }
        }
      }
    }
  }
})
