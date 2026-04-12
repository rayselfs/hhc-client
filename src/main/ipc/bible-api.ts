import { ipcMain } from 'electron'
import type { WindowManager } from '../windowManager'
import { isMainWindow } from './validate'
import type { BibleVersion, BibleBook } from '@shared/types/bible'

const API_BASE = 'https://www.alive.org.tw/api/bible/v1'

async function fetchVersions(): Promise<BibleVersion[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(`${API_BASE}/versions`, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return (await response.json()) as BibleVersion[]
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchContent(versionId: string): Promise<BibleBook[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60_000)
  try {
    const response = await fetch(`${API_BASE}/content/${versionId}`, {
      signal: controller.signal
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    if (!response.body) throw new Error('Response body is null')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const books: BibleBook[] = []
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''

      for (const block of events) {
        const lines = block.split('\n')
        let dataLine = ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            dataLine = line.slice(6)
          }
        }
        if (!dataLine) continue
        let parsed: unknown
        try {
          parsed = JSON.parse(dataLine)
        } catch {
          continue
        }
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          !('number' in parsed) ||
          !('chapters' in parsed)
        ) {
          continue
        }
        books.push(parsed as BibleBook)
      }
    }

    books.sort((a, b) => a.number - b.number)
    for (const book of books) {
      book.chapters.sort((a, b) => a.number - b.number)
      for (const chapter of book.chapters) {
        chapter.verses.sort((a, b) => a.number - b.number)
      }
    }

    return books
  } finally {
    clearTimeout(timeout)
  }
}

export function registerBibleApiHandlers(wm: WindowManager): void {
  ipcMain.handle('bible:get-versions', async (event) => {
    if (!isMainWindow(wm, event)) return []
    return fetchVersions()
  })

  ipcMain.handle('bible:get-content', async (event, versionId: string) => {
    if (!isMainWindow(wm, event)) return []
    return fetchContent(versionId)
  })
}
