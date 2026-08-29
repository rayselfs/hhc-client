import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { app, net } from 'electron'
import type { BrowserWindow, DownloadItem, Event } from 'electron'

const RELEASE_BASE_URL = 'https://github.com/rayselfs/hhc-presenter/releases/download'
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

async function downloadDmg(
  window: BrowserWindow,
  url: string,
  savePath: string,
  onProgress: (percent: number) => void
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const session = window.webContents.session
    const handleDownload = (_event: Event, item: DownloadItem): void => {
      if (!item.getURLChain().includes(url)) return

      session.removeListener('will-download', handleDownload)
      item.setSavePath(savePath)
      item.on('updated', () => {
        const total = item.getTotalBytes()
        if (total > 0) onProgress(Math.round((item.getReceivedBytes() / total) * 100))
      })
      item.once('done', (_doneEvent, state) => {
        if (state === 'completed') resolve()
        else reject(new Error(`macOS update download ${state}`))
      })
    }

    session.on('will-download', handleDownload)
    window.webContents.downloadURL(url)
  })
}

async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function removeOldDmgs(directory: string): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true })
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.dmg'))
      .map((entry) => rm(join(directory, entry.name), { force: true }))
  )
}

export async function downloadMacUpdate(
  window: BrowserWindow,
  version: string,
  onProgress: (percent: number) => void,
  onVerifying: () => void
): Promise<string> {
  if (!VERSION_PATTERN.test(version)) throw new Error('Invalid update version')

  const fileName = `hhc-presenter-${version}.dmg`
  const releaseUrl = `${RELEASE_BASE_URL}/v${version}`
  const directory = join(app.getPath('temp'), 'hhc-presenter-updates')
  const savePath = join(directory, fileName)

  await mkdir(directory, { recursive: true })
  await removeOldDmgs(directory)

  try {
    await downloadDmg(window, `${releaseUrl}/${fileName}`, savePath, onProgress)
    onVerifying()

    const response = await net.fetch(`${releaseUrl}/SHA256SUMS`)
    if (!response.ok) throw new Error(`Checksum download failed: HTTP ${response.status}`)

    const matches = (await response.text())
      .split(/\r?\n/)
      .map((line) => line.match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/))
      .filter((match) => match?.[2] === fileName)

    if (matches.length !== 1) {
      throw new Error(`Checksum manifest must contain exactly one ${fileName} entry`)
    }

    const expected = matches[0]?.[1].toLowerCase()
    const actual = await sha256(savePath)
    if (actual !== expected) throw new Error('Downloaded DMG checksum verification failed')

    return savePath
  } catch (error) {
    await rm(savePath, { force: true })
    throw error
  }
}
