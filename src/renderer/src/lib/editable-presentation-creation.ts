import type { FileItemRecord } from '@shared/types/folder'
import { openFileExplorerDB, type FileExplorerDBSchema } from './file-explorer-db'
import { deleteDerivedAssetsForSource, putDerivedAsset } from './media-work-db'
import {
  publishPersistedFileItem,
  removeCleanedEntriesFromStore
} from '@renderer/stores/file-explorer'
import { createResourceCleanupRecord } from './resource-cleanup-journal'
import { deleteThumbnail, saveThumbnail } from './thumbnail-db'
import type { IDBPDatabase } from 'idb'

export interface EditablePresentationCreationInput {
  item: FileItemRecord
  blob: Blob
  documentBody: string
  documentVariant: string
  thumbnail: string
}

interface EditablePresentationCreationDependencies {
  openFileExplorerDB: () => Promise<IDBPDatabase<FileExplorerDBSchema>>
  putDerivedAsset: typeof putDerivedAsset
  saveThumbnail: typeof saveThumbnail
  deleteDerivedAssetsForSource: typeof deleteDerivedAssetsForSource
  deleteThumbnail: typeof deleteThumbnail
  publishItem: typeof publishPersistedFileItem
  removeItem: (itemId: string) => void
}

const defaultDependencies: EditablePresentationCreationDependencies = {
  openFileExplorerDB,
  putDerivedAsset,
  saveThumbnail,
  deleteDerivedAssetsForSource,
  deleteThumbnail,
  publishItem: publishPersistedFileItem,
  removeItem: (itemId) => {
    removeCleanedEntriesFromStore({ folderIds: [], itemIds: [itemId] })
  }
}

export async function persistEditablePresentationCreation(
  input: EditablePresentationCreationInput,
  overrides: Partial<EditablePresentationCreationDependencies> = {}
): Promise<void> {
  const dependencies = { ...defaultDependencies, ...overrides }
  let catalogCommitted = false

  try {
    const db = await dependencies.openFileExplorerDB()
    const tx = db.transaction(['file-blobs', 'folder-items'], 'readwrite')
    await Promise.all([
      tx.objectStore('file-blobs').put({
        id: input.item.id,
        blob: input.blob,
        size: input.blob.size,
        refCount: 1
      }),
      tx.objectStore('folder-items').put(input.item)
    ])
    await tx.done
    catalogCommitted = true

    await dependencies.putDerivedAsset({
      sourceBlobId: input.item.id,
      kind: 'editable-presentation-document',
      variant: input.documentVariant,
      storage: 'indexed-db',
      mimeType: input.item.mimeType,
      size: input.blob.size,
      status: 'ready',
      blob: input.blob,
      metadata: {
        presentationDocumentJson: input.documentBody
      }
    })
    await dependencies.saveThumbnail(input.item.id, input.thumbnail)
    dependencies.publishItem(input.item)
  } catch (error) {
    dependencies.removeItem(input.item.id)
    if (catalogCommitted) {
      const compensation = await Promise.allSettled([
        dependencies.deleteThumbnail(input.item.id),
        dependencies.deleteDerivedAssetsForSource(input.item.id)
      ])
      const externalCleanupFailed = compensation.some((result) => result.status === 'rejected')
      const db = await dependencies.openFileExplorerDB()
      const tx = db.transaction(
        ['file-blobs', 'folder-items', 'resource-cleanup-journal'],
        'readwrite'
      )
      await Promise.all([
        tx.objectStore('file-blobs').delete(input.item.id),
        tx.objectStore('folder-items').delete(input.item.id)
      ])
      if (externalCleanupFailed) {
        await tx.objectStore('resource-cleanup-journal').put(
          createResourceCleanupRecord({
            blobId: input.item.id,
            storage: 'indexed-db',
            deleteNativeFile: false,
            deleteDerivedAssets: true,
            deletePdfPageThumbs: false,
            itemThumbnailIds: [input.item.id]
          })
        )
      }
      await tx.done
    }
    throw error
  }
}
