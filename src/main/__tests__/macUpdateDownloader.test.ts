import { EventEmitter } from 'node:events'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  tempRoot: '',
  fetch: vi.fn()
}))

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => mocks.tempRoot) },
  net: { fetch: mocks.fetch }
}))

import type { BrowserWindow } from 'electron'
import { downloadMacUpdate } from '../macUpdateDownloader'

const VERSION = '2.4.1'
const FILE_NAME = 'hhc-presenter-2.4.1.dmg'
const SHA256 = '8a4b505004ed1442db59812468099d81b607bfcbd123e4389490a46ac367d564'
const CONTENT = Buffer.from('verified dmg')

class FakeDownloadItem extends EventEmitter {
  savePath = ''

  constructor(
    private readonly url: string,
    private readonly receivedBytes = 6,
    private readonly totalBytes = 12
  ) {
    super()
  }

  getURLChain(): string[] {
    return [this.url]
  }

  setSavePath(path: string): void {
    this.savePath = path
  }

  getReceivedBytes(): number {
    return this.receivedBytes
  }

  getTotalBytes(): number {
    return this.totalBytes
  }
}

function createWindow(
  state: 'completed' | 'cancelled' | 'interrupted' = 'completed'
): BrowserWindow {
  const session = new EventEmitter()
  const webContents = {
    session,
    downloadURL(url: string) {
      const item = new FakeDownloadItem(url)
      session.emit('will-download', {}, item, webContents)
      if (item.savePath) writeFileSync(item.savePath, CONTENT)
      item.emit('updated', {}, 'progressing')
      item.emit('done', {}, state)
    }
  }

  return { webContents } as unknown as BrowserWindow
}

describe('downloadMacUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.tempRoot = mkdtempSync(join(tmpdir(), 'hhc-presenter-update-test-'))
    mocks.fetch.mockResolvedValue(new Response(`${SHA256}  ${FILE_NAME}\n`, { status: 200 }))
  })

  afterEach(() => {
    rmSync(mocks.tempRoot, { recursive: true, force: true })
  })

  it('downloads the exact release DMG, removes older DMGs, and verifies SHA-256', async () => {
    const updateDir = join(mocks.tempRoot, 'hhc-presenter-updates')
    mkdirSync(updateDir)
    writeFileSync(join(updateDir, 'hhc-presenter-2.4.0.dmg'), 'old')
    writeFileSync(join(updateDir, 'keep.txt'), 'keep')
    const progress: number[] = []
    const verifying = vi.fn()

    const result = await downloadMacUpdate(
      createWindow(),
      VERSION,
      (value) => {
        progress.push(value)
      },
      verifying
    )

    expect(result).toBe(join(updateDir, FILE_NAME))
    expect(readFileSync(result)).toEqual(CONTENT)
    expect(existsSync(join(updateDir, 'hhc-presenter-2.4.0.dmg'))).toBe(false)
    expect(existsSync(join(updateDir, 'keep.txt'))).toBe(true)
    expect(progress).toEqual([50])
    expect(verifying).toHaveBeenCalledOnce()
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://github.com/rayselfs/hhc-presenter/releases/download/v2.4.1/SHA256SUMS'
    )
  })

  it('deletes a DMG that fails checksum verification', async () => {
    mocks.fetch.mockResolvedValue(
      new Response(`${'0'.repeat(64)}  ${FILE_NAME}\n`, { status: 200 })
    )

    await expect(downloadMacUpdate(createWindow(), VERSION, vi.fn(), vi.fn())).rejects.toThrow(
      'checksum'
    )

    expect(existsSync(join(mocks.tempRoot, 'hhc-presenter-updates', FILE_NAME))).toBe(false)
  })

  it('rejects invalid release versions before downloading', async () => {
    const window = createWindow()
    const downloadSpy = vi.spyOn(window.webContents, 'downloadURL')

    await expect(downloadMacUpdate(window, '2.4.1/../../evil', vi.fn(), vi.fn())).rejects.toThrow(
      'version'
    )

    expect(downloadSpy).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('rejects interrupted downloads without attempting verification', async () => {
    await expect(
      downloadMacUpdate(createWindow('interrupted'), VERSION, vi.fn(), vi.fn())
    ).rejects.toThrow('interrupted')

    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('rejects a checksum manifest without exactly one matching DMG', async () => {
    mocks.fetch.mockResolvedValue(new Response(`${SHA256}  another-file.dmg\n`, { status: 200 }))

    await expect(downloadMacUpdate(createWindow(), VERSION, vi.fn(), vi.fn())).rejects.toThrow(
      FILE_NAME
    )
  })
})
