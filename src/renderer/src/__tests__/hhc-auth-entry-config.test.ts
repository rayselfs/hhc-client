import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OAUTH_CALLBACK_PWA_DENYLIST } from '../../../../scripts/pwa-navigation-denylist'
import { isElectron } from '@renderer/lib/env'
import { createHhcAuthAdapter } from '@renderer/lib/hhc-auth'

const adapterFactories = vi.hoisted(() => ({
  browser: vi.fn(() => ({ kind: 'browser' })),
  electron: vi.fn(() => ({ kind: 'electron' }))
}))

vi.mock('@renderer/lib/env', () => ({ isElectron: vi.fn() }))
vi.mock('@renderer/lib/hhc-auth-browser', () => ({
  createBrowserHhcAuthAdapter: adapterFactories.browser
}))
vi.mock('@renderer/lib/hhc-auth-electron', () => ({
  createElectronHhcAuthAdapter: adapterFactories.electron
}))

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

  it.each([
    ['browser', false, adapterFactories.browser, adapterFactories.electron],
    ['electron', true, adapterFactories.electron, adapterFactories.browser]
  ] as const)('creates only the detected %s adapter', async (_name, electron, selected, other) => {
    vi.mocked(isElectron).mockReturnValue(electron)
    adapterFactories.browser.mockClear()
    adapterFactories.electron.mockClear()

    await createHhcAuthAdapter()

    expect(selected).toHaveBeenCalledOnce()
    expect(other).not.toHaveBeenCalled()
  })

  it('mounts auth only in the control entry', () => {
    const control = read('src/renderer/src/control-entry.tsx')
    const main = read('src/renderer/src/main.tsx')
    const projection = read('src/renderer/src/projection-entry.tsx')

    expect(control).toContain('<HhcAuthProvider>')
    for (const entry of [main, projection]) {
      expect(entry).not.toContain('HhcAuthProvider')
      expect(entry).not.toContain('hhc-auth-browser')
      expect(entry).not.toContain('hhc-auth-electron')
    }
  })

  it('wires the public Account origin into every client build', () => {
    expect(read('.github/workflows/ci.yml')).toContain(
      'VITE_HHC_ACCOUNT_ORIGIN: ${{ vars.VITE_HHC_ACCOUNT_ORIGIN }}'
    )
    expect(read('.github/workflows/azure-static-web-apps-zealous-river-03bbb7100.yml')).toContain(
      'VITE_HHC_ACCOUNT_ORIGIN: ${{ vars.VITE_HHC_ACCOUNT_ORIGIN }}'
    )
    expect(
      read('.github/workflows/build-release.yml').match(/VITE_HHC_ACCOUNT_ORIGIN:/g)
    ).toHaveLength(2)
  })
})
