import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OAUTH_CALLBACK_PWA_DENYLIST } from '../../../../scripts/pwa-navigation-denylist'

const root = process.cwd()
const read = (file: string): string => readFileSync(resolve(root, file), 'utf8')

describe('HHC browser auth entry and hosting config', () => {
  it('dispatches the exact callback path before projection and control entries', () => {
    const main = read('src/renderer/src/main.tsx')
    expect(main.indexOf("window.location.pathname === '/oauth/callback'")).toBeGreaterThan(-1)
    expect(main.indexOf("window.location.pathname === '/oauth/callback'")).toBeLessThan(
      main.indexOf('projection')
    )
  })

  it('keeps both Static Web Apps configs identical with no-store callback headers', () => {
    const rootConfig = JSON.parse(read('staticwebapp.config.json'))
    const rendererConfig = JSON.parse(read('src/renderer/public/staticwebapp.config.json'))
    expect(rendererConfig).toEqual(rootConfig)
    expect(rootConfig.routes).toContainEqual({
      route: '/oauth/callback',
      headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
    })
  })

  it('injects only the configured Account origin into CSP and exposes it through APP_CONFIG', () => {
    expect(read('src/renderer/index.html')).toContain('__HHC_ACCOUNT_ORIGIN__')
    expect(read('electron.vite.config.ts')).toContain(
      'configuredAccountOriginCsp(buildConfig.hhcAccountOrigin)'
    )
    expect(read('src/shared/app-config.ts')).toContain('hhcAccountOrigin: __HHC_ACCOUNT_ORIGIN__')
  })

  it('keeps OAuth callback queries outside PWA navigation fallback', () => {
    expect(OAUTH_CALLBACK_PWA_DENYLIST.test('/oauth/callback?code=code-1&state=state-1')).toBe(true)
    expect(OAUTH_CALLBACK_PWA_DENYLIST.test('/oauth/callback/other')).toBe(false)
    expect(read('electron.vite.config.ts')).toContain('OAUTH_CALLBACK_PWA_DENYLIST')
  })
})
