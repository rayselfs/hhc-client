export type ThumbnailWorkerRequest =
  | { id: string; type: 'cover'; file: File; mimeType: string }
  | { id: string; type: 'pdf-pages'; file: File }
  | { id: string; type: 'cancel' }

export type ThumbnailWorkerResponse =
  | { id: string; ok: true; blobs: Blob[] }
  | {
      id: string
      ok: false
      message: string
      code?: 'background-rendering-unavailable'
    }

type ThumbnailWorkerRenderRequest =
  | { type: 'cover'; file: File; mimeType: string }
  | { type: 'pdf-pages'; file: File }

interface PendingRequest {
  resolve: (blobs: Blob[]) => void
  reject: (error: Error) => void
  removeAbortListener: () => void
}

export class BackgroundRenderingUnavailableError extends Error {
  constructor() {
    super('Background thumbnail rendering is unavailable')
  }
}

let worker: Worker | null = null
const pending = new Map<string, PendingRequest>()

function failWorker(error: Error): void {
  pending.forEach((request) => {
    request.removeAbortListener()
    request.reject(error)
  })
  pending.clear()
  worker?.terminate()
  worker = null
}

function getWorker(): Worker {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    throw new BackgroundRenderingUnavailableError()
  }
  if (worker) return worker

  worker = new Worker(new URL('../workers/thumbnail-render.worker.ts', import.meta.url), {
    type: 'module'
  })
  worker.addEventListener('message', (event: MessageEvent<ThumbnailWorkerResponse>) => {
    const request = pending.get(event.data.id)
    if (!request) return
    pending.delete(event.data.id)
    request.removeAbortListener()
    if (event.data.ok) request.resolve(event.data.blobs)
    else if (event.data.code === 'background-rendering-unavailable') {
      request.reject(new BackgroundRenderingUnavailableError())
    } else request.reject(new Error(event.data.message))
  })
  worker.addEventListener('error', () => failWorker(new Error('Thumbnail Worker failed')))
  return worker
}

async function render(
  request: ThumbnailWorkerRenderRequest,
  signal?: AbortSignal
): Promise<Blob[]> {
  signal?.throwIfAborted()
  const activeWorker = getWorker()
  const id = crypto.randomUUID()

  return new Promise((resolve, reject) => {
    const abort = (): void => {
      pending.delete(id)
      activeWorker.postMessage({ id, type: 'cancel' } satisfies ThumbnailWorkerRequest)
      reject(new DOMException('Thumbnail rendering aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', abort, { once: true })
    pending.set(id, {
      resolve,
      reject,
      removeAbortListener: () => signal?.removeEventListener('abort', abort)
    })
    activeWorker.postMessage({ ...request, id } as ThumbnailWorkerRequest)
  })
}

export async function renderCoverThumbnail(
  file: File,
  mimeType: string,
  signal?: AbortSignal
): Promise<Blob | null> {
  return (await render({ type: 'cover', file, mimeType }, signal))[0] ?? null
}

export function renderPdfPageThumbnails(file: File, signal?: AbortSignal): Promise<Blob[]> {
  return render({ type: 'pdf-pages', file }, signal)
}
