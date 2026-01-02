import { ref, type Ref } from 'vue'
import type { BibleVersion, BibleContent, BibleBook, StreamingProgress } from '@/types/bible'
import { useSentry } from './useSentry'

const API_HOST = import.meta.env.VITE_BIBLE_API_HOST || 'https://www.alive.org.tw'

import { type ApiError } from '@/types/api'

import { StorageKey, StorageCategory, getStorageKey } from '@/types/common'
import { useLocalStorage } from '@/composables/useLocalStorage'
import { useElectron } from '@/composables/useElectron'

export function useAPI() {
  const { reportError } = useSentry()
  const { getLocalItem } = useLocalStorage()
  const loading = ref(false)
  const error: Ref<ApiError | null> = ref(null)

  const {
    isElectron,
    getBibleVersions: electronGetBibleVersions,
    onBibleContentChunk: electronOnBibleContentChunk,
    getBibleContent: electronGetBibleContent,
    removeAllListeners,
  } = useElectron()

  /**
   * Get all Bible versions
   * @returns List of Bible versions
   */
  const getBibleVersions = async (): Promise<BibleVersion[]> => {
    loading.value = true
    error.value = null

    try {
      if (isElectron()) {
        const data = await electronGetBibleVersions()
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

      // If API returns empty array or invalid data, throw error
      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error('API returned empty or invalid data')
      }

      return data
    } catch (err) {
      // When API fails, log error and try to load from cache
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

      // If cache is also empty, throw error
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Get specific version of Bible content (using Streaming)
   * @param versionId - Version ID
   * @param progress - Progress callback function
   * @returns Bible content
   */
  const getBibleContent = async (
    versionId: number,
    progress?: StreamingProgress,
  ): Promise<BibleContent> => {
    loading.value = true
    error.value = null

    console.log('Getting Bible content from API for version ID:', versionId)

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
        electronOnBibleContentChunk((chunk) => {
          controller.enqueue(chunk)
        })

        // Call API
        // Start the request
        electronGetBibleContent(versionId)
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
        const url = `${API_HOST}/api/bible/v1/content/${versionId}`

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
      let currentEventData = ''

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          // Keep the last partial line in the buffer
          buffer = lines.pop() || ''

          for (const line of lines) {
            // Trim whitespace to handle slightly malformed streams more gracefully,
            // though standard SSE is strict.
            const trimmedLine = line.trim()

            if (trimmedLine === '') {
              // Empty line marks end of event
              if (currentEventData) {
                try {
                  const event = JSON.parse(currentEventData)

                  if (event.type === 'start') {
                    isStarted = true
                    progress?.onStart?.()
                  } else if (event.type === 'complete') {
                    progress?.onComplete?.(bookCount)
                    break
                  } else if (event.type === 'error') {
                    throw new Error(event.message)
                  } else if (event.type === 'timeout') {
                    throw new Error('Request Timeout')
                  } else if (event.version_id) {
                    bibleContent.version_id = event.version_id
                    bibleContent.version_code = event.version_code
                    bibleContent.version_name = event.version_name
                    if (event.updated_at) {
                      bibleContent.updated_at = event.updated_at
                    }
                  } else if (event.id && event.name && isStarted) {
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
                  }
                } catch (parseError) {
                  console.warn(
                    'Failed to parse SSE event:',
                    parseError,
                    'Version ID:',
                    versionId,
                    'Event Data:',
                    currentEventData,
                  )
                }
                currentEventData = ''
              }
            } else if (line.startsWith('data: ')) {
              const content = line.slice(6)
              currentEventData += (currentEventData ? '\n' : '') + content
            } else if (currentEventData && !line.startsWith(':')) {
              currentEventData += '\n' + line
            }
          }
        }
      } finally {
        reader.releaseLock()
        if (isElectron()) {
          removeAllListeners('api-bible-content-chunk')
        }
      }

      // Sort content before returning
      if (bibleContent.books) {
        bibleContent.books.sort((a, b) => a.number - b.number)

        bibleContent.books.forEach((book) => {
          if (book.chapters) {
            book.chapters.sort((a, b) => a.number - b.number)
            book.chapters.forEach((chapter) => {
              if (chapter.verses) {
                chapter.verses.sort((a, b) => a.number - b.number)
              }
            })
          }
        })
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

  return {
    loading,
    error,
    getBibleVersions,
    getBibleContent,
  }
}
