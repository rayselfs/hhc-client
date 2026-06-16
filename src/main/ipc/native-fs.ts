import { app, ipcMain, net, protocol } from 'electron'
import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import { dirname, isAbsolute, join, resolve } from 'path'
import { pathToFileURL } from 'url'
import { isValidNativeFileId } from '../../shared/native-media'
import type { WindowManager } from '../windowManager'
import { isMainWindow } from './validate'

const NATIVE_MEDIA_SCHEME = 'hhc-media:'
const NATIVE_MEDIA_HOST = 'file'
const MIME_TYPE_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i

function getNativeFsDir(): string {
  return resolve(app.getPath('userData'), 'native-files')
}

export function getNativeFilePath(id: unknown): string {
  if (!isValidNativeFileId(id)) throw new Error('Invalid native file id')

  const baseDir = getNativeFsDir()
  const filePath = resolve(baseDir, id)
  if (dirname(filePath) !== baseDir) throw new Error('Native file path escapes storage directory')
  return filePath
}

export function parseNativeMediaUrl(requestUrl: string): { id: string; mimeType: string } | null {
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== NATIVE_MEDIA_SCHEME || url.hostname !== NATIVE_MEDIA_HOST) return null

    const encodedId = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname
    const id = decodeURIComponent(encodedId)
    if (!isValidNativeFileId(id)) return null

    const requestedMimeType = url.searchParams.get('type') ?? ''
    const mimeType = MIME_TYPE_PATTERN.test(requestedMimeType)
      ? requestedMimeType
      : 'application/octet-stream'
    return { id, mimeType }
  } catch {
    return null
  }
}

export function registerNativeFsHandlers(wm: WindowManager): void {
  ipcMain.handle(
    'native-fs:import-file',
    async (event, id: unknown, sourcePath: unknown): Promise<{ size: number }> => {
      if (!isMainWindow(wm, event)) throw new Error('Unauthorized native file import')
      const destinationPath = getNativeFilePath(id)
      if (typeof sourcePath !== 'string' || !isAbsolute(sourcePath)) {
        throw new Error('Invalid native file source')
      }

      const sourceStat = await fs.stat(sourcePath)
      if (!sourceStat.isFile()) throw new Error('Native file source is not a file')

      const dir = getNativeFsDir()
      await fs.mkdir(dir, { recursive: true })
      const temporaryPath = join(dir, `.${id}.${randomUUID()}.tmp`)

      try {
        await fs.copyFile(sourcePath, temporaryPath)
        const copiedStat = await fs.stat(temporaryPath)
        if (!copiedStat.isFile() || copiedStat.size !== sourceStat.size) {
          throw new Error('Native file copy verification failed')
        }
        await fs.rename(temporaryPath, destinationPath)
        return { size: copiedStat.size }
      } catch (error) {
        await fs.unlink(temporaryPath).catch(() => undefined)
        throw error
      }
    }
  )

  ipcMain.handle('native-fs:delete-file', async (event, id: unknown): Promise<void> => {
    if (!isMainWindow(wm, event)) throw new Error('Unauthorized native file deletion')
    const filePath = getNativeFilePath(id)
    try {
      await fs.unlink(filePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  })
}

export function registerNativeMediaProtocol(): void {
  protocol.handle('hhc-media', async (request) => {
    const parsed = parseNativeMediaUrl(request.url)
    if (!parsed) return new Response('Invalid media URL', { status: 400 })

    try {
      const filePath = getNativeFilePath(parsed.id)
      const response = await net.fetch(pathToFileURL(filePath).toString(), {
        headers: request.headers
      })
      const headers = new Headers(response.headers)
      headers.set('Content-Type', parsed.mimeType)
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      })
    } catch {
      return new Response('Media not found', { status: 404 })
    }
  })
}
