import { ipcMain, app, nativeImage, protocol, net } from 'electron'
import { pathToFileURL } from 'url'
import { v4 as uuidv4 } from 'uuid'
import * as Sentry from '@sentry/electron'
import path from 'path'
import { copyFileSync, mkdirSync, existsSync, writeFileSync, rmSync } from 'fs'

export const registerFileProtocols = () => {
  protocol.handle('local-resource', (request) => {
    try {
      const parsedUrl = new URL(request.url)
      let filePath = parsedUrl.pathname

      // Handle cases where the first part of the path is treated as the host
      if (parsedUrl.host) {
        filePath = path.join('/', parsedUrl.host, filePath)
      }

      let decodedPath = decodeURIComponent(filePath)

      // On Windows, strip leading slash if it precedes a drive letter
      if (process.platform === 'win32') {
        // e.g., /C:/Users/... -> C:/Users/...
        if (decodedPath.match(/^\/[a-zA-Z]:/)) {
          decodedPath = decodedPath.slice(1)
        }
        // Ensure path uses backslashes
        decodedPath = path.normalize(decodedPath)
      }

      return net.fetch(pathToFileURL(decodedPath).toString())
    } catch (error) {
      console.error('Failed to handle protocol request:', request.url, error)
      return new Response('Not Found', { status: 404 })
    }
  })
}

export const registerFileHandlers = () => {
  // Handle save file
  ipcMain.handle('save-file', async (event, sourcePath: string) => {
    try {
      const userDataPath = app.getPath('userData')
      const mediaDir = path.join(userDataPath, 'media')

      // Ensure media directory exists
      if (!existsSync(mediaDir)) {
        mkdirSync(mediaDir, { recursive: true })
      }

      const ext = path.extname(sourcePath)
      const filename = `${uuidv4()}${ext}`
      const destinationPath = path.join(mediaDir, filename)

      copyFileSync(sourcePath, destinationPath)

      // Generate thumbnail
      let thumbnailPath: string | undefined
      try {
        const thumb = await nativeImage.createThumbnailFromPath(destinationPath, {
          width: 300,
          height: 300,
        })

        if (!thumb.isEmpty()) {
          const thumbnailsDir = path.join(userDataPath, 'thumbnails')
          if (!existsSync(thumbnailsDir)) {
            mkdirSync(thumbnailsDir, { recursive: true })
          }

          const thumbFilename = `${path.basename(filename, ext)}.png`
          thumbnailPath = path.join(thumbnailsDir, thumbFilename)

          writeFileSync(thumbnailPath, thumb.toPNG())
        }
      } catch (thumbError) {
        console.warn('Failed to generate thumbnail:', thumbError)
        // Non-fatal error, continue without thumbnail
      }

      return {
        filePath: destinationPath,
        thumbnailPath,
      }
    } catch (error) {
      console.error('Failed to save file:', error)
      Sentry.captureException(error, {
        tags: {
          operation: 'save-file',
        },
        extra: {
          context: 'Failed to save file',
          sourcePath,
        },
      })
      throw error
    }
  })

  // Handle reset user data
  ipcMain.handle('reset-user-data', async () => {
    try {
      const userDataPath = app.getPath('userData')
      const mediaDir = path.join(userDataPath, 'media')
      const thumbnailsDir = path.join(userDataPath, 'thumbnails')

      if (existsSync(mediaDir)) {
        rmSync(mediaDir, { recursive: true, force: true })
      }
      if (existsSync(thumbnailsDir)) {
        rmSync(thumbnailsDir, { recursive: true, force: true })
      }
      return true
    } catch (error) {
      console.error('Failed to reset user data:', error)
      return false
    }
  })
}
