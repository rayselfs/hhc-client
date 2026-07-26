import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Blob as NodeBlob } from 'node:buffer'
import type { FileItemRecord } from '@shared/types/folder'
import { createBlankEditablePresentationDocument } from '../editable-presentation'
import {
  openFileExplorerDB,
  resetFileExplorerDBForTests,
  type FileBlobRecord
} from '../file-explorer-db'
import { getDerivedAsset, resetMediaWorkDBForTests } from '../media-work-db'
import {
  persistEditablePresentationRevision,
  refreshEditablePresentationThumbnail,
  type EditablePresentationRevisionWrite
} from '../editable-presentation-persistence'
import { EDITABLE_PRESENTATION_MIME_TYPE } from '../presentation-media'

const item: FileItemRecord = {
  id: 'deck-1',
  parentId: 'file-root',
  type: 'file',
  sortIndex: 0,
  createdAt: 1,
  expiresAt: null,
  name: 'Original',
  url: 'blob:deck-source',
  size: 1,
  mimeType: EDITABLE_PRESENTATION_MIME_TYPE
}
const initialDocument = createBlankEditablePresentationDocument(
  'Original',
  '00000000-0000-4000-8000-000000000004'
)

function createWrite(
  overrides: Partial<EditablePresentationRevisionWrite> = {}
): EditablePresentationRevisionWrite {
  return {
    itemId: item.id,
    sourceBlobId: 'deck-source',
    revision: 4,
    document: { ...initialDocument, name: 'Renamed' },
    catalogName: 'Renamed',
    ...overrides
  }
}

async function readBlobText(blob: Blob | undefined): Promise<string> {
  if (!blob) throw new Error('Expected a source blob')
  if (typeof blob.text === 'function') return blob.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

async function seedAuthority(
  source: FileBlobRecord = {
    id: 'deck-source',
    blob: new Blob([JSON.stringify(initialDocument)], {
      type: EDITABLE_PRESENTATION_MIME_TYPE
    }),
    size: 1,
    refCount: 1,
    revision: 1
  }
): Promise<void> {
  const db = await openFileExplorerDB()
  const tx = db.transaction(['file-blobs', 'folder-items'], 'readwrite')
  await Promise.all([
    tx.objectStore('file-blobs').put(source),
    tx.objectStore('folder-items').put(item)
  ])
  await tx.done
}

beforeEach(async () => {
  vi.stubGlobal('Blob', NodeBlob)
  await resetFileExplorerDBForTests()
  await resetMediaWorkDBForTests()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('persistEditablePresentationRevision', () => {
  it('commits the source blob and catalog rename in one revision', async () => {
    await seedAuthority()

    const result = await persistEditablePresentationRevision(createWrite())

    const db = await openFileExplorerDB()
    const source = await db.get('file-blobs', 'deck-source')
    const catalog = await db.get('folder-items', item.id)
    const mirror = await getDerivedAsset(
      'deck-source',
      'editable-presentation-document',
      `document:${item.id}`
    )
    expect(result).toEqual({ revision: 4, mirrorWarnings: [] })
    expect(source).toMatchObject({ revision: 4, refCount: 1 })
    expect(JSON.parse(await readBlobText(source?.blob))).toMatchObject({ name: 'Renamed' })
    expect(catalog).toMatchObject({ name: 'Renamed', size: source?.blob?.size })
    expect(mirror?.metadata).toMatchObject({
      presentationRevision: 4,
      presentationDocumentJson: expect.stringContaining('"name":"Renamed"')
    })
  })

  it('does not update the catalog when the source authority is missing', async () => {
    const db = await openFileExplorerDB()
    await db.put('folder-items', item)

    await expect(persistEditablePresentationRevision(createWrite())).rejects.toThrow(
      'Editable presentation source is missing'
    )

    await expect(db.get('folder-items', item.id)).resolves.toEqual(item)
    await expect(db.get('file-blobs', 'deck-source')).resolves.toBeUndefined()
  })

  it('does not update the source when the catalog authority is missing', async () => {
    const originalSource: FileBlobRecord = {
      id: 'deck-source',
      blob: new Blob([JSON.stringify(initialDocument)], {
        type: EDITABLE_PRESENTATION_MIME_TYPE
      }),
      size: 1,
      refCount: 1,
      revision: 1
    }
    const db = await openFileExplorerDB()
    await db.put('file-blobs', originalSource)

    await expect(persistEditablePresentationRevision(createWrite())).rejects.toThrow(
      'Editable presentation catalog item is missing'
    )

    const unchanged = await db.get('file-blobs', 'deck-source')
    expect(unchanged).toMatchObject({ revision: 1, size: 1 })
    expect(JSON.parse(await readBlobText(unchanged?.blob))).toMatchObject({ name: 'Original' })
  })

  it('reports a derived-document warning after authority commits', async () => {
    await seedAuthority()

    const result = await persistEditablePresentationRevision(createWrite(), {
      putDerivedAsset: vi.fn().mockRejectedValue(new Error('derived unavailable'))
    })

    const db = await openFileExplorerDB()
    await expect(db.get('file-blobs', 'deck-source')).resolves.toMatchObject({ revision: 4 })
    await expect(db.get('folder-items', item.id)).resolves.toMatchObject({ name: 'Renamed' })
    expect(result).toEqual({ revision: 4, mirrorWarnings: ['derived-document'] })
  })
})

describe('refreshEditablePresentationThumbnail', () => {
  it('persists the generated cover independently from the document revision', async () => {
    await refreshEditablePresentationThumbnail(initialDocument)

    const cover = await getDerivedAsset(initialDocument.id, 'cover-thumbnail')
    expect(cover).toMatchObject({
      sourceBlobId: initialDocument.id,
      status: 'ready',
      mimeType: 'image/svg+xml'
    })
  })

  it('publishes the refreshed cover to mounted file views', async () => {
    const listener = vi.fn()
    window.addEventListener('hhc:thumbnail-ready', listener)

    await refreshEditablePresentationThumbnail(initialDocument)

    expect(listener).toHaveBeenCalledTimes(1)
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toMatchObject({
      itemId: initialDocument.id,
      dataUrl: expect.stringMatching(/^data:image\/svg\+xml;base64,/)
    })
    window.removeEventListener('hhc:thumbnail-ready', listener)
  })
})
