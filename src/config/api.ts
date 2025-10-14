/**
 * API 配置檔案
 * 用於管理各種 API 的 host 地址
 */

export const API_CONFIG = {
  // 主要 API (Bible API) 的 host 地址
  MAIN_API_HOST: import.meta.env.VITE_BIBLE_API_HOST || 'https://www.alive.org.tw',

  // 預留：其他 API host 可以在這裡添加
  // 例如：
  // MEDIA_API_HOST: import.meta.env.VITE_MEDIA_API_HOST || 'http://localhost:8081',
  // AUTH_API_HOST: import.meta.env.VITE_AUTH_API_HOST || 'http://localhost:8082',
}

/**
 * 取得主要 API 的 host 地址
 * @returns API host URL
 */
export function getMainApiHost(): string {
  return API_CONFIG.MAIN_API_HOST
}
