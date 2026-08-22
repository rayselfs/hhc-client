import { APP_CONFIG } from './app-config'

export const BIBLE_API = {
  base: `${APP_CONFIG.bibleApi.host}${APP_CONFIG.bibleApi.v1Prefix}`,
  versions: `${APP_CONFIG.bibleApi.host}${APP_CONFIG.bibleApi.v2Prefix}/versions`,
  content: (versionId: number) =>
    `${APP_CONFIG.bibleApi.host}${APP_CONFIG.bibleApi.v1Prefix}/content/${versionId}`
} as const
