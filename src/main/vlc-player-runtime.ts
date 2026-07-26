export type VlcPlayerRuntime = typeof import('electron-vlc-player')

export type VlcPlayerRuntimeResult =
  | { status: 'ready'; runtime: VlcPlayerRuntime }
  | { status: 'error'; message: string }

type ImportVlcPlayerRuntime = () => Promise<VlcPlayerRuntime>

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createVlcPlayerRuntimeLoader(
  importRuntime: ImportVlcPlayerRuntime = () => import('electron-vlc-player')
): () => Promise<VlcPlayerRuntimeResult> {
  let resultPromise: Promise<VlcPlayerRuntimeResult> | null = null

  return () => {
    resultPromise ??= importRuntime()
      .then((runtime): VlcPlayerRuntimeResult => ({ status: 'ready', runtime }))
      .catch(
        (error): VlcPlayerRuntimeResult => ({
          status: 'error',
          message: `VLC native binding unavailable: ${errorMessage(error)}`
        })
      )
    return resultPromise
  }
}

export const loadVlcPlayerRuntime = createVlcPlayerRuntimeLoader()
