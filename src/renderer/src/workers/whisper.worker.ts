/**
 * Whisper Web Worker — runs Transformers.js automatic-speech-recognition
 * Uses local-model:// custom protocol to read model files from user-selected directory
 * Only active in Electron mode (custom protocol requires main process registration)
 */

export type WhisperWorkerIncoming = { type: 'transcribe'; audio: Float32Array; language?: string }

export type WhisperWorkerOutgoing =
  | { type: 'result'; text: string }
  | { type: 'error'; message: string }
  | { type: 'ready' }

let transcriber: unknown = null

async function loadPipeline(): Promise<void> {
  try {
    const { pipeline, env } = await import('@xenova/transformers')
    ;(env as Record<string, unknown>)['remoteHost'] = 'local-model://whisper'
    ;(env as Record<string, unknown>)['remotePathTemplate'] = '{model}/{file}'
    ;(env as Record<string, unknown>)['allowLocalModels'] = false
    transcriber = await pipeline('automatic-speech-recognition', 'whisper')
    self.postMessage({ type: 'ready' } satisfies WhisperWorkerOutgoing)
  } catch (e) {
    self.postMessage({ type: 'error', message: String(e) } satisfies WhisperWorkerOutgoing)
  }
}

self.onmessage = async (event: MessageEvent<WhisperWorkerIncoming>) => {
  const { data } = event
  if (data.type === 'transcribe') {
    if (!transcriber) {
      await loadPipeline()
    }
    try {
      const result = await (transcriber as (audio: Float32Array) => Promise<{ text: string }>)(
        data.audio
      )
      self.postMessage({ type: 'result', text: result.text } satisfies WhisperWorkerOutgoing)
    } catch (e) {
      self.postMessage({ type: 'error', message: String(e) } satisfies WhisperWorkerOutgoing)
    }
  }
}

loadPipeline()
