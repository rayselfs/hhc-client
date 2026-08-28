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

  it('injects the configured Account and Asset origins into CSP and APP_CONFIG', () => {
    const html = read('src/renderer/index.html')
    expect(html).toContain('__HHC_ACCOUNT_ORIGIN__')
    expect(html.match(/__HHC_ASSET_ORIGIN__/g)).toHaveLength(3)
    expect(html).toContain('<meta name="referrer" content="no-referrer" />')

    expect(read('electron.vite.config.ts')).toContain(
      'configuredOriginsCsp(buildConfig.hhcAccountOrigin, buildConfig.hhcAssetOrigin)'
    )
    expect(read('src/shared/app-config.ts')).toContain('hhcAccountOrigin: __HHC_ACCOUNT_ORIGIN__')
    expect(read('src/shared/app-config.ts')).toContain('hhcAssetOrigin: __HHC_ASSET_ORIGIN__')
  })

  it('allows Google account avatars only through img-src', () => {
    const html = read('src/renderer/index.html')
    const imgSrc = html.match(/img-src ([^;]+);/)?.[1]

    expect(imgSrc).toContain('https://lh3.googleusercontent.com')
    expect(imgSrc?.split(/\s+/)).not.toContain('https:')
    expect(html.match(/https:\/\/lh3\.googleusercontent\.com/g)).toHaveLength(1)
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

  it('wires the public Account and Asset origins into every client build', () => {
    const ci = read('.github/workflows/ci.yml')
    const staticWebApp = read('.github/workflows/azure-static-web-apps-zealous-river-03bbb7100.yml')
    const release = read('.github/workflows/build-release.yml')

    expect(ci).toContain('VITE_HHC_ACCOUNT_ORIGIN: ${{ vars.VITE_HHC_ACCOUNT_ORIGIN }}')
    expect(ci).toContain('VITE_HHC_ASSET_ORIGIN: ${{ vars.VITE_HHC_ASSET_ORIGIN }}')
    expect(staticWebApp).toContain('VITE_HHC_ACCOUNT_ORIGIN: ${{ vars.VITE_HHC_ACCOUNT_ORIGIN }}')
    expect(staticWebApp).toContain('VITE_HHC_ASSET_ORIGIN: ${{ vars.VITE_HHC_ASSET_ORIGIN }}')
    expect(release.match(/VITE_HHC_ACCOUNT_ORIGIN:/g)).toHaveLength(2)
    expect(release.match(/VITE_HHC_ASSET_ORIGIN:/g)).toHaveLength(2)
  })

  it('builds tag and manual desktop artifacts through one explicit unsigned path', () => {
    const builder = read('electron-builder.yml')
    const release = read('.github/workflows/build-release.yml')

    expect(builder).toMatch(/^\s*identity:\s*null\s*$/m)
    expect(builder).toMatch(/^\s*hardenedRuntime:\s*false\s*$/m)
    expect(builder).toMatch(/^\s*notarize:\s*false\s*$/m)
    expect(release).toContain("- 'v*.*.*'")
    expect(release).toContain('workflow_dispatch:')

    const packageStep = release.match(
      /- name: Build explicit unsigned desktop package[\s\S]*?(?=\n\s{6}- name:)/
    )?.[0]
    expect(packageStep).toBeDefined()
    expect(packageStep).not.toMatch(/\n\s+if:/)
    expect(packageStep).toContain('CSC_IDENTITY_AUTO_DISCOVERY: false')
    expect(packageStep).toContain('--config.forceCodeSigning=false')
    expect(packageStep).toContain('--config.mac.identity=null')
    expect(packageStep).toContain('--config.mac.notarize=false')

    expect(release).not.toMatch(/MAC_CSC_|WIN_CSC_|APPLE_API_|check:signed-package/)
    expect(release).toContain('npm run check:packaged-runtime')
    expect(release).toContain('npm run test:e2e:packaged')
    expect(release).toContain('actions/upload-artifact@')
    expect(release).toContain('dist/*.zip')
  })

  it('publishes checksums generated from the packaged release artifacts', () => {
    const release = read('.github/workflows/build-release.yml')
    const checksumStep = release.match(
      /- name: Generate release checksums[\s\S]*?(?=\n\s{6}- name:)/
    )?.[0]

    expect(checksumStep).toBeDefined()
    expect(checksumStep).toContain('release-artifacts')
    expect(checksumStep).toContain('sha256sum')
    expect(checksumStep).toContain('SHA256SUMS')
    expect(checksumStep).toContain('test -s')
    expect(release).toContain('needs: [quality-gates, prepare, package]')
    expect(release.indexOf('- name: Download desktop artifacts')).toBeLessThan(
      release.indexOf('- name: Generate release checksums')
    )
    expect(release.indexOf('- name: Generate release checksums')).toBeLessThan(
      release.indexOf('- name: Publish GitHub release')
    )
    expect(release).toContain('gh release create "${GITHUB_REF_NAME}" release-artifacts/*')
  })

  it('keeps Asset tickets outside runtime caches and persisted browser storage', () => {
    const config = read('electron.vite.config.ts')
    expect(config).toContain('navigateFallbackDenylist: [/^\\/api\\//')
    expect(config).not.toMatch(/runtimeCaching:[\s\S]*api\/assets/)

    for (const file of [
      'src/renderer/src/lib/hhc-asset-api-browser.ts',
      'src/renderer/src/lib/hhc-asset-api-electron.ts',
      'src/main/ipc/hhc-assets.ts'
    ]) {
      expect(read(file)).toContain('APP_CONFIG.hhcAssetOrigin')
      expect(read(file)).not.toContain("const HHC_ASSET_ORIGIN = 'https://www.alive.org.tw'")
    }
  })
})
