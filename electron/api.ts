import { ipcMain } from 'electron'
import * as Sentry from '@sentry/electron'

const API_HOST = import.meta.env.VITE_BIBLE_API_HOST || 'https://www.alive.org.tw'

export const registerApiHandlers = () => {
  // Get Bible Versions
  ipcMain.handle('api-bible-get-versions', async () => {
    try {
      const response = await fetch(`${API_HOST}/api/bible/v1/versions`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return await response.json()
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'api-bible-get-versions' },
      })
      throw error
    }
  })

  // Get Bible Content (Streaming)
  ipcMain.handle('api-bible-get-content', async (event, versionId: number) => {
    try {
      const response = await fetch(`${API_HOST}/api/bible/v1/content/${versionId}`, {
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Response body is null')
      }

      // Read the stream
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        // Send chunk to renderer
        // We send it as a buffer/array
        event.sender.send('api-bible-content-chunk', value)
      }

      return { success: true }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'api-bible-get-content' },
        extra: { versionId },
      })
      throw error
    }
  })
}
