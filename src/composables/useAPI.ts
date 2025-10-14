import { ref, type Ref } from 'vue'
import { getMainApiHost } from '@/config/api'
import type { BibleVersion, BibleContent, BibleBook, StreamingProgress } from '@/types/bible'

/**
 * API 錯誤介面
 */
export interface ApiError {
  message: string
  status?: number
}

/**
 * useAPI composable
 * 處理與 Bible API 的通訊
 */
export function useAPI() {
  const loading = ref(false)
  const error: Ref<ApiError | null> = ref(null)

  /**
   * 預設的聖經版本列表（當 API 失敗時使用）
   */
  const DEFAULT_VERSIONS: BibleVersion[] = [
    {
      id: 1,
      code: 'CUV-TW',
      name: '和合本（繁體）',
    },
  ]

  /**
   * 取得所有聖經版本
   * @returns 聖經版本列表，如果 API 失敗則返回預設值
   */
  const getBibleVersions = async (): Promise<BibleVersion[]> => {
    loading.value = true
    error.value = null

    try {
      const apiHost = getMainApiHost()
      const url = `${apiHost}/api/bible/v1/versions`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: BibleVersion[] = await response.json()

      // 如果 API 回傳空陣列或無效數據，使用預設值
      if (!data || !Array.isArray(data) || data.length === 0) {
        console.warn('API returned empty or invalid data, using default versions')
        return DEFAULT_VERSIONS
      }

      return data
    } catch (err) {
      // API 失敗時，記錄錯誤並返回預設值
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      console.error('Failed to fetch Bible versions:', errorMessage)

      error.value = {
        message: errorMessage,
        status: err instanceof Response ? err.status : undefined,
      }

      // 返回預設值
      return DEFAULT_VERSIONS
    } finally {
      loading.value = false
    }
  }

  /**
   * 取得特定版本的聖經內容（使用 Streaming）
   * @param versionId - 版本 ID
   * @param progress - 進度回調函數
   * @returns 聖經內容
   */
  const getBibleContent = async (
    versionId: number,
    progress?: StreamingProgress,
  ): Promise<BibleContent> => {
    loading.value = true
    error.value = null

    try {
      const apiHost = getMainApiHost()
      const url = `${apiHost}/api/bible/v1/version/${versionId}`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      // 處理 Server-Sent Events
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      const bibleContent: BibleContent = {
        version_id: versionId,
        version_code: '',
        version_name: '',
        books: [],
      }

      let buffer = ''
      let bookCount = 0
      let isStarted = false

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // 處理完整的 SSE 事件
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // 保留不完整的行

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const eventData = line.slice(6) // 移除 'data: ' 前綴

              try {
                const event = JSON.parse(eventData)

                if (event.type === 'start') {
                  isStarted = true
                  progress?.onStart?.()
                } else if (event.type === 'complete') {
                  progress?.onComplete?.(bookCount)
                  break
                } else if (event.type === 'error') {
                  throw new Error(event.message)
                } else if (event.type === 'timeout') {
                  throw new Error('請求超時')
                } else {
                  // 處理書籍數據
                  if (event.id && event.name && isStarted) {
                    const book: BibleBook = {
                      id: event.id,
                      number: event.number,
                      name: event.name,
                      abbreviation: event.abbreviation,
                      chapters: event.chapters || [],
                    }

                    bibleContent.books.push(book)
                    bookCount++

                    progress?.onBookReceived?.(book, bookCount - 1, bookCount)
                  } else if (event.version_id && !isStarted) {
                    // 處理版本信息
                    bibleContent.version_id = event.version_id
                    bibleContent.version_code = event.version_code
                    bibleContent.version_name = event.version_name
                  }
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE event:', parseError)
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      return bibleContent
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      console.error('Failed to fetch Bible content:', errorMessage)

      error.value = {
        message: errorMessage,
        status: err instanceof Response ? err.status : undefined,
      }

      progress?.onError?.(errorMessage)
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    getBibleVersions,
    getBibleContent,
  }
}
