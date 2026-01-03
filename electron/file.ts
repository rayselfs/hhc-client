import { ipcMain, app, nativeImage, protocol, net } from 'electron'
import { pathToFileURL } from 'url'
import { v4 as uuidv4 } from 'uuid'
import * as Sentry from '@sentry/electron'
import path from 'path'
import { promises as fs } from 'fs'

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

      // Security Check: Ensure we are not allowing traversal outside intended limits if needed.
      // For a general local resource loader, we might trust the path if it's within allowed dirs,
      // but 'local-resource' often implies broad access.
      // STRICTLY prevent relative path traversal attempts if they somehow survived normalization.
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
      try {
        await fs.access(mediaDir)
      } catch {
        await fs.mkdir(mediaDir, { recursive: true })
      }

      const ext = path.extname(sourcePath)
      const filename = `${uuidv4()}${ext}`
      const destinationPath = path.join(mediaDir, filename)

      // Async copy
      await fs.copyFile(sourcePath, destinationPath)

      // Generate thumbnail
      let thumbnailPath: string | undefined
      try {
        // Thumbnail generation is already async, but let's be robust
        const thumb = await nativeImage.createThumbnailFromPath(destinationPath, {
          width: 300,
          height: 300,
        })

        if (!thumb.isEmpty()) {
          const thumbnailsDir = path.join(userDataPath, 'thumbnails')
          try {
            await fs.access(thumbnailsDir)
          } catch {
            await fs.mkdir(thumbnailsDir, { recursive: true })
          }

          const thumbFilename = `${path.basename(filename, ext)}.png`
          thumbnailPath = path.join(thumbnailsDir, thumbFilename)

          // Async write
          await fs.writeFile(thumbnailPath, thumb.toPNG())
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

      const removeDir = async (dirPath: string) => {
        try {
          // fs.rm with recursive: true is equivalent to rm -rf
          await fs.rm(dirPath, { recursive: true, force: true })
        } catch (e) {
          // Ignore if it doesn't exist or other minor errors, but log warning
          console.warn(`Failed to remove ${dirPath}`, e)
        }
      }

      await Promise.all([removeDir(mediaDir), removeDir(thumbnailsDir)])

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
      // Normalize paths for reliable comparison
      const normalizedFilePath = path.normalize(filePath)
      const normalizedUserDataPath = path.normalize(userDataPath)

      // Security check: ensure file is within userData directory
      if (!normalizedFilePath.startsWith(normalizedUserDataPath)) {
        console.warn('Security alert: Attempted to delete file outside userData:', filePath)
        return false
      }

      await fs.unlink(normalizedFilePath)
      return true
    } catch (error) {
      // It's possible the file doesn't exist, which is fine
      console.warn('Failed to delete file (may not exist):', filePath, error)
      return false
    }
  })

  // Handle copy file
  ipcMain.handle('copy-file', async (event, sourceUrl: string) => {
    try {
      const userDataPath = app.getPath('userData')
      // Extract partial path from local-resource:// URL or absolute path
      let cleanSourcePath = sourceUrl
      if (cleanSourcePath.startsWith('local-resource://')) {
        cleanSourcePath = cleanSourcePath.replace('local-resource://', '')
      }

      const normalizedSourcePath = path.normalize(cleanSourcePath)
      const normalizedUserDataPath = path.normalize(userDataPath)

      // Security check
      if (!normalizedSourcePath.startsWith(normalizedUserDataPath)) {
        console.warn('Security alert: Attempted to copy file from outside userData:', sourceUrl)
        return null
      }

      // Construct new destination path
      const mediaDir = path.join(userDataPath, 'media')
      const ext = path.extname(normalizedSourcePath)
      const newFilename = `${uuidv4()}${ext}`
      const destinationPath = path.join(mediaDir, newFilename)

      // Copy main file
      await fs.copyFile(normalizedSourcePath, destinationPath)

      // Check for and copy thumbnail if exists
      let thumbnailPath: string | undefined
      const thumbFilenameBase = path.basename(normalizedSourcePath, ext)
      const thumbSourcePath = path.join(userDataPath, 'thumbnails', `${thumbFilenameBase}.png`)

      try {
        await fs.access(thumbSourcePath)
        // If exists, copy it
        const thumbnailsDir = path.join(userDataPath, 'thumbnails')
        try {
          await fs.access(thumbnailsDir)
        } catch {
          await fs.mkdir(thumbnailsDir, { recursive: true })
        }

        const newThumbFilename = `${path.basename(newFilename, ext)}.png`
        const newThumbPath = path.join(thumbnailsDir, newThumbFilename)

        await fs.copyFile(thumbSourcePath, newThumbPath)
        thumbnailPath = newThumbPath
      } catch {
        // No thumbnail found or copy failed, ignore
      }

      return {
        filePath: destinationPath,
        thumbnailPath,
      }
    } catch (error) {
      console.error('Failed to copy file:', sourceUrl, error)
      return null
    }
  })
}
