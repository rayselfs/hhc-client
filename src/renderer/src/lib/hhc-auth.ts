import { APP_CONFIG } from '@shared/app-config'

export const HHC_AUTH = {
  accountApi: `${APP_CONFIG.hhcAccountOrigin}/api/account/v1`,
  authorize: `${APP_CONFIG.hhcAccountOrigin}/api/account/v1/oauth/authorize`,
  token: `${APP_CONFIG.hhcAccountOrigin}/api/account/v1/oauth/token`,
  callbackUri: 'https://client.alive.org.tw/oauth/callback',
  clientId: 'client-web',
  scope: 'openid profile'
} as const
