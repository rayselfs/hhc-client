import { ipcMain, app, nativeImage, protocol, net } from 'electron'
import { pathToFileURL } from 'url'
import { v4 as uuidv4 } from 'uuid'
import * as Sentry from '@sentry/electron'
import path from 'path'
import fs from 'fs-extra'

/**
 * Registers a custom protocol 'local-resource://' to safely serve local files.
 * Handles quirks between Windows and macOS/Linux.
 */
export const registerFileProtocols = () => {
  protocol.handle('local-resource', (request) => {
    try {
      const requestUrl = new URL(request.url)

      // Decode the URL path (handling spaces and special chars)
      let filePath = decodeURIComponent(requestUrl.pathname)

      // On Windows, the drive letter might be in the hostname for some URL constructions,
      // or the path might start with a slash that needs removing (e.g. /C:/...)
      if (process.platform === 'win32') {
        // Case 1: Host contains the drive letter (e.g., local-resource://c/path/to/file)
        if (requestUrl.host && /^[a-zA-Z]$/.test(requestUrl.host)) {
          filePath = `${requestUrl.host}:${filePath}`
        }
        // Case 2: Path starts with a leading slash before the drive letter (e.g., /C:/path)
        else if (filePath.match(/^\/[a-zA-Z]:/)) {
          filePath = filePath.slice(1)
        }

        // Normalize separates (converts / to \ on Windows) and resolves '..'
        filePath = path.normalize(filePath)
      } else {
        // macOS/Linux: Just ensure it's treated as an absolute path if host is present
        if (requestUrl.host) {
          filePath = path.join('/', requestUrl.host, filePath)
        }
        filePath = path.normalize(filePath)
      }

      // Security Check
      if (filePath.includes('..')) {
        console.warn('Blocked potential path traversal:', filePath)
        return new Response('Forbidden', { status: 403 })
      }

      return net.fetch(pathToFileURL(filePath).toString())
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
      await fs.ensureDir(mediaDir)

      const ext = path.extname(sourcePath)
      const filename = `${uuidv4()}${ext}`
      const destinationPath = path.join(mediaDir, filename)

      // Async copy
      await fs.copy(sourcePath, destinationPath)

      // Generate thumbnail
      let thumbnailData: Buffer | undefined
      try {
        const thumb = await nativeImage.createThumbnailFromPath(destinationPath, {
          width: 300,
          height: 300,
        })

        if (!thumb.isEmpty()) {
          thumbnailData = thumb.toJPEG(80)
        }
      } catch (thumbError) {
        console.warn('Failed to generate thumbnail:', thumbError)
      }

      return {
        filePath: destinationPath,
        thumbnailData,
      }
    } catch (error) {
      console.error('Failed to save file:', error)
      Sentry.captureException(error, {
        tags: { operation: 'save-file' },
        extra: { sourcePath },
      })
      throw error
    }
  })

  // Handle list directory (Lazy Loading support)
  ipcMain.handle('list-directory', async (event, dirPath: string) => {
    try {
      const userDataPath = app.getPath('userData')
      const targetPath = path.isAbsolute(dirPath) ? dirPath : path.join(userDataPath, dirPath)

      // Security check
      if (!targetPath.startsWith(userDataPath)) {
        throw new Error('Access denied: Output outside userData')
      }

      const entries = await fs.readdir(targetPath, { withFileTypes: true })
      return await Promise.all(
        entries.map(async (entry) => {
          const entryPath = path.join(targetPath, entry.name)
          const stats = await fs.stat(entryPath)
          const isDirectory = entry.isDirectory()

          return {
            name: entry.name,
            isDirectory,
            path: entryPath,
            size: stats.size,
            modifiedAt: stats.mtimeMs,
          }
        }),
      )
    } catch (error) {
      console.error('Failed to list directory:', error)
      return []
    }
  })

  // Handle reset user data
  ipcMain.handle('reset-user-data', async () => {
    try {
      const userDataPath = app.getPath('userData')
      const mediaDir = path.join(userDataPath, 'media')

      await Promise.all([fs.remove(mediaDir).catch(() => {})])

      return true
    } catch (error) {
      console.error('Failed to reset user data:', error)
      return false
    }
  })

  // Handle delete file
  ipcMain.handle('delete-file', async (event, filePath: string) => {
    try {
      const userDataPath = app.getPath('userData')
      const normalizedFilePath = path.normalize(filePath)
      const normalizedUserDataPath = path.normalize(userDataPath)

      if (!normalizedFilePath.startsWith(normalizedUserDataPath)) {
        console.warn('Security alert: Attempted to delete file outside userData:', filePath)
        return false
      }

      await fs.remove(normalizedFilePath)
      return true
    } catch (error) {
      console.warn('Failed to delete file:', filePath, error)
      return false
    }
  })

  // Handle copy file
  ipcMain.handle('copy-file', async (event, sourceUrl: string) => {
    try {
      const userDataPath = app.getPath('userData')
      let cleanSourcePath = sourceUrl
      if (cleanSourcePath.startsWith('local-resource://')) {
        cleanSourcePath = cleanSourcePath.replace('local-resource://', '')
      }

      const normalizedSourcePath = path.normalize(cleanSourcePath)
      const normalizedUserDataPath = path.normalize(userDataPath)

      if (!normalizedSourcePath.startsWith(normalizedUserDataPath)) {
        console.warn('Security alert: Attempted to copy file from outside userData:', sourceUrl)
        return null
      }

      const mediaDir = path.join(userDataPath, 'media')
      const ext = path.extname(normalizedSourcePath)
      const newFilename = `${uuidv4()}${ext}`
      const destinationPath = path.join(mediaDir, newFilename)

      await fs.copy(normalizedSourcePath, destinationPath)

      // We don't copy physical thumbnails anymore,
      // they will be generated if missing or we could just skip for copy
      // For now, let's just return the new file path.
      // Frontend can handle thumbnail migration or re-generation if needed.

      return {
        filePath: destinationPath,
      }
    } catch (error) {
      console.error('Failed to copy file:', sourceUrl, error)
      return null
    }
  })
}
