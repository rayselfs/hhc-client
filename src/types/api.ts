/**
 * API 響應接口
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * API 錯誤介面
 */
export interface ApiError {
  message: string
  status?: number
}
