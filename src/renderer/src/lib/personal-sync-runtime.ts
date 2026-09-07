import { PersonalCloudHttpError, type PersonalMutationRequest } from '@shared/personal-cloud'
import type { PersonalCloudProvider } from './personal-cloud-provider'
import {
  acknowledgePersonalOperation,
  listPersonalOutbox,
  updatePersonalOperationTransfer,
  type PersonalOutboxRecord
} from './personal-sync-db'

// One durable step; the account scheduler owns retry timing, cancellation and lease renewal.
export async function advancePersonalOutbox(
  ownerId: string,
  workerId: string,
  api: PersonalCloudProvider,
  signal: AbortSignal
): Promise<'empty' | 'acknowledged' | 'scanning' | 'blocked'> {
  signal.throwIfAborted()
  let operation = (await listPersonalOutbox(ownerId))[0]
  if (!operation) return 'empty'
  if (operation.failure) return 'blocked'
  if (operation.dependsOn) throw new Error('Personal outbox dependency is unresolved')
  const update = async (
    value: Parameters<typeof updatePersonalOperationTransfer>[3]
  ): Promise<void> => {
    operation = await updatePersonalOperationTransfer(
      ownerId,
      workerId,
      operation.id,
      value,
      signal
    )
  }
  // Validate the current lease before starting any network operation.
  await update({})
  try {
    if (!operation.submittedRequest) {
      if (operation.snapshotBlobId) {
        if (!operation.fileName || !operation.mimeType || !operation.sizeBytes) {
          throw new PersonalCloudHttpError(0, 'source-missing')
        }
        const input = {
          fileName: operation.fileName,
          mimeType: operation.mimeType,
          sizeBytes: operation.sizeBytes
        }
        let upload
        try {
          upload = operation.uploadId
            ? await api.getUpload(operation.uploadId, signal)
            : await api.createUpload(
                input,
                `${operation.id}-upload-${operation.uploadAttempt ?? 0}`,
                signal
              )
        } catch (error) {
          if (!(error instanceof PersonalCloudHttpError) || ![404, 410].includes(error.status))
            throw error
          await update({ uploadId: undefined, uploadAttempt: (operation.uploadAttempt ?? 0) + 1 })
          return 'scanning'
        }
        if (upload.id !== operation.uploadId) await update({ uploadId: upload.id })
        if (Date.parse(upload.expiresAt) <= Date.now()) {
          await update({ uploadId: undefined, uploadAttempt: (operation.uploadAttempt ?? 0) + 1 })
          return 'scanning'
        }
        if (upload.uploadStatus === 'created') {
          await api.uploadSnapshot(upload.id, operation.snapshotBlobId, signal)
          upload = await api.completeUpload(
            upload.id,
            { mimeType: input.mimeType, sizeBytes: input.sizeBytes },
            signal
          )
        }
        if (
          upload.uploadStatus === 'failed' ||
          upload.scanStatus === 'infected' ||
          upload.scanStatus === 'failed' ||
          upload.processingStatus === 'failed'
        ) {
          await update({ failure: 'invalid-content' })
          return 'blocked'
        }
        if (
          upload.scanStatus !== 'clean' ||
          !['ready', 'not_required'].includes(upload.processingStatus)
        )
          return 'scanning'
      }
      await update({ submittedRequest: mutationRequest(operation) })
    }
    const request = operation.submittedRequest
    if (!request) throw new Error('Missing durable personal request')
    const result = await api.mutate(request, signal)
    await acknowledgePersonalOperation(ownerId, operation.id, result, signal, workerId)
    return 'acknowledged'
  } catch (error) {
    signal.throwIfAborted()
    if (!(error instanceof PersonalCloudHttpError)) throw error
    if (error.code === 'asset-not-ready') return 'scanning'
    if (
      error.status === 409 ||
      [400, 413, 422].includes(error.status) ||
      error.code === 'source-missing'
    ) {
      await update({ failure: error.status === 409 ? 'conflict' : error.code })
      return 'blocked'
    }
    throw error
  }
}

function mutationRequest(operation: PersonalOutboxRecord): PersonalMutationRequest {
  return {
    ...operation.mutation,
    operationId: operation.id,
    itemId: operation.remoteId,
    expectedRevision: operation.expectedRevision,
    expectedCollectionRevision: operation.expectedCollectionRevision,
    ...(operation.uploadId ? { uploadId: operation.uploadId } : {})
  }
}
