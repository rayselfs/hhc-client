import { app, ipcMain } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'

const getNativeFsDir = (): string => join(app.getPath('userData'), 'native-files')

export function registerNativeFsHandlers(): void {
  ipcMain.handle('native-fs:store-file', async (_, id: string, buffer: ArrayBuffer) => {
    const dir = getNativeFsDir()
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(join(dir, id), Buffer.from(buffer))
  })

  ipcMain.handle('native-fs:read-file', async (_, id: string) => {
    const buffer = await fs.readFile(join(getNativeFsDir(), id))
    return buffer.buffer
  })

  ipcMain.handle('native-fs:delete-file', async (_, id: string) => {
    await fs.unlink(join(getNativeFsDir(), id)).catch(() => {})
  })
}
