import type { BibleBook, BibleVersion } from '@shared/types/bible'
import { isElectron } from './env'

export type BibleApiErrorType = 'timeout' | 'network' | 'parse'

export class BibleApiError extends Error {
  type: BibleApiErrorType

  constructor(type: BibleApiErrorType, message: string) {
    super(message)
    this.type = type
    this.name = 'BibleApiError'
  }
}

export interface BibleApiAdapter {
  fetchVersions(): Promise<BibleVersion[]>
  fetchContent(versionId: string): Promise<BibleBook[]>
}

interface SseStartEvent {
  type: 'start'
  message?: string
}

interface SseCompleteEvent {
  type: 'complete'
  total_books?: number
}

interface SseErrorEvent {
  type: 'error'
  message: string
}

interface SseTimeoutEvent {
  type: 'timeout'
}

interface SseVersionEvent {
  version_id: number | string
  version_code: string
  version_name: string
  updated_at?: number
}

interface SseBookEvent {
  id: number
  number: number
  name: string
  abbreviation: string
  chapters: BibleBook['chapters']
}

type SseEvent =
  | SseStartEvent
  | SseCompleteEvent
  | SseErrorEvent
  | SseTimeoutEvent
  | SseVersionEvent
  | SseBookEvent

function sortBooks(books: BibleBook[]): BibleBook[] {
  books.sort((a, b) => a.number - b.number)
  for (const book of books) {
    if (book.chapters) {
      book.chapters.sort((a, b) => a.number - b.number)
      for (const chapter of book.chapters) {
        if (chapter.verses) {
          chapter.verses.sort((a, b) => a.number - b.number)
        }
      }
    }
  }
  return books
}

async function parseSSEStream(stream: ReadableStream<Uint8Array>): Promise<BibleBook[]> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const books: BibleBook[] = []
  let buffer = ''
  let currentEventData = ''
  let isStarted = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      // SSE chunks may split mid-line — keep the last partial line in buffer for next read
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmedLine = line.trim()

        if (trimmedLine === '') {
          if (currentEventData) {
            try {
              const event = JSON.parse(currentEventData) as SseEvent

              if ('type' in event) {
                if (event.type === 'start') {
                  isStarted = true
                } else if (event.type === 'complete') {
                  break
                } else if (event.type === 'error') {
                  throw new BibleApiError('network', event.message)
                } else if (event.type === 'timeout') {
                  throw new BibleApiError('timeout', 'Server timeout during SSE stream')
                }
              } else if (
                !('version_id' in event) &&
                'id' in event &&
                'name' in event &&
                isStarted
              ) {
                const bookEvent = event as SseBookEvent
                books.push({
                  number: bookEvent.number,
                  code: String(bookEvent.id),
                  name: bookEvent.name,
                  abbreviation: bookEvent.abbreviation,
                  chapters: bookEvent.chapters ?? []
                })
              }
            } catch (parseError) {
              if (parseError instanceof BibleApiError) throw parseError
              console.warn('[bible-api] Failed to parse SSE event:', parseError, currentEventData)
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
  }

  return sortBooks(books)
}

export class ElectronBibleApiAdapter implements BibleApiAdapter {
  async fetchVersions(): Promise<BibleVersion[]> {
    return window.api.bible.getVersions()
  }

  async fetchContent(versionId: string): Promise<BibleBook[]> {
    const books = await window.api.bible.getContent(versionId)
    return sortBooks(books)
  }
}

const TIMEOUT_MS = 30_000

export class BrowserBibleApiAdapter implements BibleApiAdapter {
  async fetchVersions(): Promise<BibleVersion[]> {
    return this.withRetry(() => this.doFetchVersions())
  }

  async fetchContent(versionId: string): Promise<BibleBook[]> {
    return this.withRetry(() => this.doFetchContent(versionId))
  }

  private async doFetchVersions(): Promise<BibleVersion[]> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const response = await fetch('/api/bible/v1/versions', { signal: controller.signal })
      if (!response.ok) {
        throw new BibleApiError('network', `HTTP ${response.status}: ${response.statusText}`)
      }
      return (await response.json()) as BibleVersion[]
    } catch (error) {
      if (error instanceof BibleApiError) throw error
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new BibleApiError('timeout', 'Request timed out after 30s')
      }
      throw new BibleApiError('network', error instanceof Error ? error.message : String(error))
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private async doFetchContent(versionId: string): Promise<BibleBook[]> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const response = await fetch(`/api/bible/v1/content/${versionId}`, {
        signal: controller.signal
      })
      if (!response.ok) {
        throw new BibleApiError('network', `HTTP ${response.status}: ${response.statusText}`)
      }
      if (!response.body) {
        throw new BibleApiError('network', 'Response body is empty')
      }
      return await parseSSEStream(response.body)
    } catch (error) {
      if (error instanceof BibleApiError) throw error
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new BibleApiError('timeout', 'Request timed out after 30s')
      }
      throw new BibleApiError('network', error instanceof Error ? error.message : String(error))
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch {
      return await fn()
    }
  }
}

export function createBibleApiAdapter(): BibleApiAdapter {
  if (isElectron()) {
    return new ElectronBibleApiAdapter()
  }
  return new BrowserBibleApiAdapter()
}
