import { ref, type Ref } from 'vue'
import type {
  BibleVersion,
  BibleContent,
  BibleBook,
  StreamingProgress,
  SearchResult,
} from '@/types/bible'
import { useSentry } from './useSentry'

const API_HOST = import.meta.env.VITE_BIBLE_API_HOST || 'https://www.alive.org.tw'

/**
 * API 錯誤介面
 */
export interface ApiError {
  message: string
  status?: number
}

import { StorageKey, StorageCategory, getStorageKey } from '@/types/common'
import { useLocalStorage } from '@/composables/useLocalStorage'
import { useElectron } from '@/composables/useElectron'

export function useAPI() {
  const { reportError } = useSentry()
  const { getLocalItem } = useLocalStorage()
  const loading = ref(false)
  const error: Ref<ApiError | null> = ref(null)

  const { isElectron } = useElectron()

  /**
   * 取得所有聖經版本
   * @returns 聖經版本列表
   */
  const getBibleVersions = async (): Promise<BibleVersion[]> => {
    loading.value = true
    error.value = null

    try {
      if (isElectron()) {
        const data = await window.electronAPI.getBibleVersions()
        return data
      }

      const url = `${API_HOST}/api/bible/v1/versions`
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: BibleVersion[] = await response.json()

      // 如果 API 回傳空陣列或無效數據，拋出錯誤
      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error('API returned empty or invalid data')
      }

      return data
    } catch (err) {
      // API 失敗時，記錄錯誤並嘗試從快取讀取
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      reportError(err, {
        operation: 'fetch-bible-versions',
        component: 'useAPI',
      })

      error.value = {
        message: errorMessage,
        status: err instanceof Response ? err.status : undefined,
      }

      // Try to load from cache
      const versionsStorageKey = getStorageKey(StorageCategory.BIBLE, StorageKey.VERSIONS)
      const cachedVersions = getLocalItem<BibleVersion[]>(versionsStorageKey, 'object')

      if (cachedVersions && cachedVersions.length > 0) {
        console.log('Loaded Bible versions from cache due to API failure')
        return cachedVersions
      }

      // 如果快取也沒有，則拋出錯誤
      throw err
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
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined

      if (isElectron()) {
        // Create a push-source readable stream
        let controller: ReadableStreamDefaultController<Uint8Array>
        const stream = new ReadableStream<Uint8Array>({
          start(c) {
            controller = c
          },
        })

        // Setup listener
        window.electronAPI.onBibleContentChunk((chunk) => {
          controller.enqueue(chunk)
        })

        // Call API
        // Start the request
        window.electronAPI
          .getBibleContent(versionId)
          .then(() => {
            // When the promise resolves (success: true), we assume stream is done?
            // Actually my api.ts implementation finishes loop then returns.
            // So yes, we can close the stream here.
            controller.close()
          })
          .catch((err) => {
            controller.error(err)
          })

        reader = stream.getReader()
      } else {
        const url = `${API_HOST}/api/bible/v1/version/${versionId}`

        const headers: HeadersInit = {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        }

        const response = await fetch(url, {
          method: 'GET',
          headers,
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        if (!response.body) {
          throw new Error('Response body is null')
        }

        reader = response.body.getReader()
      }

      // Shared Processing Logic
      const decoder = new TextDecoder()
      const bibleContent: BibleContent = {
        version_id: versionId,
        version_code: '',
        version_name: '',
        updated_at: 0,
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
                    if (event.updated_at) {
                      bibleContent.updated_at = event.updated_at
                    }
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
        if (isElectron()) {
          window.electronAPI.removeAllListeners('api-bible-content-chunk')
        }
      }

      return bibleContent
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      reportError(err, {
        operation: 'fetch-bible-content',
        component: 'useAPI',
      })

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

  /**
   * 搜索聖經經文
   * @param q - 搜索關鍵字
   * @param versionCode - 版本代碼（如 'CUV-TW'）
   * @param top - 返回結果數量，預設為 20
   * @returns 搜索結果列表
   */
  const searchBibleVerses = async (
    q: string,
    versionCode: string,
    top: number = 20,
  ): Promise<SearchResult[]> => {
    loading.value = true
    error.value = null

    try {
      if (isElectron()) {
        return await window.electronAPI.searchBibleVerses({ q, versionCode, top })
      }

      const encodedQuery = encodeURIComponent(q)
      const url = `${API_HOST}/api/bible/v1/search?q=${encodedQuery}&version=${versionCode}&top=${top}`

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // 確保返回的是陣列
      if (!Array.isArray(data)) {
        return []
      }

      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      reportError(err, {
        operation: 'search-bible-verses',
        component: 'useAPI',
      })

      error.value = {
        message: errorMessage,
        status: err instanceof Response ? err.status : undefined,
      }

      return []
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    getBibleVersions,
    getBibleContent,
    searchBibleVerses,
  }
}
