import { resolve } from 'path'
import { readFileSync } from 'fs'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'
import { loadEnv, type Plugin } from 'vite'
import { rendererManualChunk } from './scripts/renderer-manual-chunk'
import { OAUTH_CALLBACK_PWA_DENYLIST } from './scripts/pwa-navigation-denylist'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
const DEFAULT_ONEDRIVE_CLIENT_ID = '4f4c2f2c-8f2a-4c4b-9d2e-8c3a7d638c02'
const DEFAULT_BIBLE_API_HOST = 'https://www.alive.org.tw'
const DEFAULT_BIBLE_API_V1_PREFIX = '/api/bible/v1'
const DEFAULT_BIBLE_API_V2_PREFIX = '/api/bible/v2'
const DEFAULT_HHC_ACCOUNT_ORIGIN = 'https://account.alive.org.tw'
const DEFAULT_HHC_ASSET_ORIGIN = 'https://www.alive.org.tw'

function cleanPath(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim()
  if (!trimmed) return fallback
  return trimmed.startsWith('/') ? trimmed.replace(/\/+$/, '') || '/' : fallback
}

function cleanHttpOrigin(value: string | undefined, fallback: string): string {
  const candidate = value?.trim() || fallback
  try {
    const url = new URL(candidate)
    if (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    ) {
      return url.origin
    }
  } catch {
    // Fall back to the production Account origin for invalid build input.
  }
  return fallback
}

function createBuildConfig(mode: string): {
  bibleApiHost: string
  hhcAccountOrigin: string
  hhcAssetOrigin: string
  defines: Record<string, string>
} {
  const env = loadEnv(mode, process.cwd(), '')
  const clientId = env.VITE_ONEDRIVE_CLIENT_ID?.trim()
  const oneDriveClientId =
    clientId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)
      ? clientId
      : DEFAULT_ONEDRIVE_CLIENT_ID
  const bibleApiHost = env.VITE_BIBLE_API_HOST?.trim() || DEFAULT_BIBLE_API_HOST
  const hhcAccountOrigin = cleanHttpOrigin(env.VITE_HHC_ACCOUNT_ORIGIN, DEFAULT_HHC_ACCOUNT_ORIGIN)
  const hhcAssetOrigin = cleanHttpOrigin(env.VITE_HHC_ASSET_ORIGIN, DEFAULT_HHC_ASSET_ORIGIN)

  return {
    bibleApiHost,
    hhcAccountOrigin,
    hhcAssetOrigin,
    defines: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __ONEDRIVE_CLIENT_ID__: JSON.stringify(oneDriveClientId),
      __HHC_ACCOUNT_ORIGIN__: JSON.stringify(hhcAccountOrigin),
      __HHC_ASSET_ORIGIN__: JSON.stringify(hhcAssetOrigin),
      __BIBLE_API_HOST__: JSON.stringify(bibleApiHost),
      __BIBLE_API_V1_PREFIX__: JSON.stringify(
        cleanPath(env.VITE_BIBLE_API_V1_PREFIX, DEFAULT_BIBLE_API_V1_PREFIX)
      ),
      __BIBLE_API_V2_PREFIX__: JSON.stringify(
        cleanPath(env.VITE_BIBLE_API_V2_PREFIX, DEFAULT_BIBLE_API_V2_PREFIX)
      )
    }
  }
}

function configuredAccountOriginCsp(accountOrigin: string): Plugin {
  return {
    name: 'configured-account-origin-csp',
    transformIndexHtml(html) {
      return html.replaceAll('__HHC_ACCOUNT_ORIGIN__', accountOrigin)
    }
  }
}

function devCspUnsafeInline(): Plugin {
  return {
    name: 'dev-csp-unsafe-inline',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
    }
  }
}

export default defineConfig(({ mode }) => {
  const buildConfig = createBuildConfig(mode)

  return {
    main: {
      define: buildConfig.defines,
      resolve: {
        alias: {
          '@shared': resolve('src/shared')
        }
      }
    },
    preload: {
      define: buildConfig.defines,
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
      define: buildConfig.defines,
      worker: {
        format: 'es'
      },
      plugins: [
        react(),
        tailwindcss(),
        configuredAccountOriginCsp(buildConfig.hhcAccountOrigin),
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
              '**/assets/microsoft.cognitiveservices.speech.sdk-*.js',
              '**/assets/aiden0z-pptx-renderer*.js',
              '**/assets/hhc-asset-api-*.js',
              '**/assets/hhc-line-access-*.js',
              '**/assets/hhc-line-connect-*.js'
            ],
            navigateFallback: '/index.html',
            navigateFallbackDenylist: [/^\/api\//, OAUTH_CALLBACK_PWA_DENYLIST],
            runtimeCaching: [
              {
                urlPattern: ({ url }) =>
                  url.pathname.endsWith('.woff2') ||
                  /\/assets\/(pdf|transformers|microsoft\.cognitiveservices\.speech\.sdk)-/.test(
                    url.pathname
                  ) ||
                  /\/assets\/aiden0z-pptx-renderer/.test(url.pathname),
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
            target: buildConfig.bibleApiHost,
            changeOrigin: true,
            secure: true
          }
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: rendererManualChunk
          }
        }
      }
    }
  }
})
