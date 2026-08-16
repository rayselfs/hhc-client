import { APP_CONFIG } from '@shared/app-config'
import type { HhcAuthAdapter } from '@shared/hhc-auth'
import { isElectron } from './env'

export const HHC_AUTH = {
  accountApi: `${APP_CONFIG.hhcAccountOrigin}/api/account/v1`,
  authorize: `${APP_CONFIG.hhcAccountOrigin}/api/account/v1/oauth/authorize`,
  token: `${APP_CONFIG.hhcAccountOrigin}/api/account/v1/oauth/token`,
  callbackUri: 'https://client.alive.org.tw/oauth/callback',
  clientId: 'client-web',
  scope: 'openid profile'
} as const

export async function createHhcAuthAdapter(): Promise<HhcAuthAdapter> {
  if (isElectron()) {
    const { createElectronHhcAuthAdapter } = await import('./hhc-auth-electron')
    return createElectronHhcAuthAdapter()
  }

  const { createBrowserHhcAuthAdapter } = await import('./hhc-auth-browser')
  return createBrowserHhcAuthAdapter()
}
