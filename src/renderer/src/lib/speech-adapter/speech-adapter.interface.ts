export interface SpeechRecognizedResult {
  text: string
  bookNumber: number
  chapter: number
  verse: number
  confidence: 'exact' | 'pinyin' | 'fuzzy'
}

export interface SpeechAdapterConfig {
  subscriptionKey: string
  region: string
  language?: string
}

export type SpeechAdapterEventType =
  | 'recognizing'
  | 'recognized'
  | 'sessionStarted'
  | 'sessionStopped'
  | 'canceled'
  | 'error'

export interface SpeechAdapterEventMap {
  recognizing: { text: string }
  recognized: SpeechRecognizedResult
  sessionStarted: undefined
  sessionStopped: undefined
  canceled: { reason: string }
  error: { error: Error; message: string }
}

export type SpeechAdapterEventListener<T extends SpeechAdapterEventType> = (
  data: SpeechAdapterEventMap[T]
) => void

export interface SpeechAdapter {
  start(): Promise<void>
  stop(): Promise<void>
  isRecognizing(): boolean
  on<T extends SpeechAdapterEventType>(
    event: T,
    listener: SpeechAdapterEventListener<T>
  ): () => void
  dispose(): void
}
