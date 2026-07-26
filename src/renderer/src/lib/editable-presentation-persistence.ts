import type { IDBPDatabase } from 'idb'
import type { EditablePresentationDocument } from './editable-presentation'
import {
  EDITABLE_PRESENTATION_DOCUMENT_KIND,
  generateEditablePresentationThumbnail,
  getEditablePresentationDocumentVariant
} from './editable-presentation'
import { openFileExplorerDB, type FileExplorerDBSchema } from './file-explorer-db'
import { putDerivedAsset } from './media-work-db'
import { EDITABLE_PRESENTATION_MIME_TYPE } from './presentation-media'
import { saveThumbnail } from './thumbnail-db'
import { isFileItem } from '@shared/types/folder'

export interface EditablePresentationRevisionWrite {
  itemId: string
  sourceBlobId: string
  revision: number
  document: EditablePresentationDocument
  catalogName?: string
}

export interface EditablePresentationRevisionResult {
  revision: number
  mirrorWarnings: Array<'derived-document'>
}

interface EditablePresentationPersistenceDependencies {
  openFileExplorerDB: () => Promise<IDBPDatabase<FileExplorerDBSchema>>
  putDerivedAsset: typeof putDerivedAsset
}

const defaultDependencies: EditablePresentationPersistenceDependencies = {
  openFileExplorerDB,
  putDerivedAsset
}

async function putEditableDocumentMirror(
  write: EditablePresentationRevisionWrite,
  body: string,
  blob: Blob,
  putAsset: typeof putDerivedAsset
): Promise<void> {
  await putAsset({
    sourceBlobId: write.sourceBlobId,
    kind: EDITABLE_PRESENTATION_DOCUMENT_KIND,
    variant: getEditablePresentationDocumentVariant(write.itemId),
    storage: 'indexed-db',
    mimeType: EDITABLE_PRESENTATION_MIME_TYPE,
    size: blob.size,
    status: 'ready',
    blob,
    metadata: {
      presentationDocumentJson: body,
      presentationRevision: write.revision
    }
  })
}

export async function persistEditablePresentationRevision(
  write: EditablePresentationRevisionWrite,
  overrides: Partial<EditablePresentationPersistenceDependencies> = {}
): Promise<EditablePresentationRevisionResult> {
  const dependencies = { ...defaultDependencies, ...overrides }
  const body = JSON.stringify(write.document)
  const blob = new Blob([body], { type: EDITABLE_PRESENTATION_MIME_TYPE })
  const db = await dependencies.openFileExplorerDB()
  const tx = db.transaction(['file-blobs', 'folder-items'], 'readwrite')
  const sourceStore = tx.objectStore('file-blobs')
  const catalogStore = tx.objectStore('folder-items')
  const [source, item] = await Promise.all([
    sourceStore.get(write.sourceBlobId),
    catalogStore.get(write.itemId)
  ])
  if (!source) {
    tx.abort()
    await tx.done.catch(() => undefined)
    throw new Error(`Editable presentation source is missing: ${write.sourceBlobId}`)
  }
  if (!item || !isFileItem(item)) {
    tx.abort()
    await tx.done.catch(() => undefined)
    throw new Error(`Editable presentation catalog item is missing: ${write.itemId}`)
  }

  await Promise.all([
    sourceStore.put({
      ...source,
      blob,
      size: blob.size,
      revision: write.revision
    }),
    catalogStore.put({
      ...item,
      name: write.catalogName ?? item.name,
      size: blob.size
    })
  ])
  await tx.done

  try {
    await putEditableDocumentMirror(write, body, blob, dependencies.putDerivedAsset)
    return { revision: write.revision, mirrorWarnings: [] }
  } catch {
    return { revision: write.revision, mirrorWarnings: ['derived-document'] }
  }
}

export async function refreshEditablePresentationThumbnail(
  document: EditablePresentationDocument
): Promise<void> {
  const thumbnail = generateEditablePresentationThumbnail(document)
  await saveThumbnail(document.id, thumbnail)
  window.dispatchEvent(
    new CustomEvent('hhc:thumbnail-ready', {
      detail: { itemId: document.id, dataUrl: thumbnail }
    })
  )
}
