/**
 * API 配置檔案
 * 用於管理各種 API 的 host 地址
 */

export const API_CONFIG = {
  // 主要 API (Bible API) 的 host 地址
  MAIN_API_HOST: import.meta.env.VITE_BIBLE_API_HOST || 'https://www.alive.org.tw',
}

/**
 * 取得主要 API 的 host 地址
 * @returns API host URL
 */
export function getMainApiHost(): string {
  return API_CONFIG.MAIN_API_HOST
}
