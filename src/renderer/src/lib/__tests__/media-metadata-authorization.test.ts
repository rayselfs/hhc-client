import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openFileExplorerDB, resetFileExplorerDBForTests } from '../file-explorer-db'
import { ensureSourceMediaMetadata } from '../media-metadata'
import { getDerivedAsset, resetMediaWorkDBForTests } from '../media-work-db'

describe('source media metadata authorization', () => {
  beforeEach(async () => {
    await Promise.all([resetFileExplorerDBForTests(), resetMediaWorkDBForTests()])
    URL.createObjectURL = vi.fn(() => 'blob:guarded-image')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not persist metadata when authorization changes during image probing', async () => {
    const db = await openFileExplorerDB()
    await db.put('file-blobs', {
      id: 'guarded-image',
      blob: new Blob(['png'], { type: 'image/png' }),
      storage: 'indexed-db',
      refCount: 1
    })
    let finishProbe!: () => void
    class DeferredImage {
      naturalWidth = 100
      naturalHeight = 50
      onload: (() => void) | null = null
      onerror: (() => void) | null = null

      set src(_value: string) {
        finishProbe = () => this.onload?.()
      }
    }
    vi.stubGlobal('Image', DeferredImage)
    let authorized = true
    const canCommit = vi.fn(async () => authorized)

    const metadata = ensureSourceMediaMetadata('guarded-image', 'image/png', canCommit)
    await vi.waitFor(() => expect(finishProbe).toBeTypeOf('function'))
    authorized = false
    finishProbe()
    await metadata

    expect(canCommit).toHaveBeenCalled()
    await expect(getDerivedAsset('guarded-image', 'media-metadata')).resolves.toBeUndefined()
  })

  it('reads native video metadata without invoking VLC', async () => {
    const probe = vi.fn()
    vi.stubGlobal('window', {
      api: {
        nativeFs: {
          exists: vi.fn().mockResolvedValue(true),
          getUrl: vi.fn(() => 'hhc-media://file/native-video')
        },
        projectionVlc: { probe }
      }
    })
    const db = await openFileExplorerDB()
    await db.put('file-blobs', {
      id: 'native-video',
      storage: 'native-fs',
      refCount: 1
    })
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      if (tagName !== 'video') return originalCreateElement(tagName, options)
      const video = {
        preload: '',
        onloadedmetadata: null as (() => void) | null,
        onerror: null as (() => void) | null,
        videoWidth: 1920,
        videoHeight: 1080,
        duration: 12,
        set src(_value: string) {
          queueMicrotask(() => this.onloadedmetadata?.())
        },
        removeAttribute: vi.fn(),
        load: vi.fn()
      }
      return video as unknown as HTMLVideoElement
    })

    await expect(ensureSourceMediaMetadata('native-video', 'video/mp4')).resolves.toMatchObject({
      kind: 'video',
      durationMs: 12000
    })
    expect(probe).not.toHaveBeenCalled()
  })
})
