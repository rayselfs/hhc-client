const BIBLE_API_HOST = 'https://www.alive.org.tw'
const BIBLE_API_PREFIX = '/api/bible/v1'

export const BIBLE_API = {
  base: `${BIBLE_API_HOST}${BIBLE_API_PREFIX}`,
  versions: `${BIBLE_API_HOST}${BIBLE_API_PREFIX}/versions`,
  content: (versionId: number) => `${BIBLE_API_HOST}${BIBLE_API_PREFIX}/content/${versionId}`
} as const
