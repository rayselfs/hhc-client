import type {
  SpeechAdapter,
  SpeechAdapterEventType,
  SpeechAdapterEventListener,
  SpeechAdapterEventMap
} from '../speech-adapter.interface'

interface WebSpeechRecognitionAlternative {
  readonly confidence: number
  readonly transcript: string
}
interface WebSpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  readonly [index: number]: WebSpeechRecognitionAlternative
}
interface WebSpeechRecognitionResultList {
  readonly length: number
  item(index: number): WebSpeechRecognitionResult
  readonly [index: number]: WebSpeechRecognitionResult
}
interface WebSpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: WebSpeechRecognitionResultList
}
interface WebSpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}
interface IWebSpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: WebSpeechRecognitionEvent) => void) | null
  onerror: ((event: WebSpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  start(): void
  stop(): void
}

export interface WebSpeechAdapterConfig {
  language: string
  maxSessionMs?: number
  idleTimeoutMs?: number
}

export class WebSpeechAdapter implements SpeechAdapter {
  private recognition: IWebSpeechRecognition | null = null
  private active = false
  private listeners: Map<
    SpeechAdapterEventType,
    Set<SpeechAdapterEventListener<SpeechAdapterEventType>>
  > = new Map()
  private config: WebSpeechAdapterConfig

  constructor(config: WebSpeechAdapterConfig) {
    this.config = config
  }

  async start(): Promise<void> {
    const win = window as unknown as Record<string, unknown>
    const SpeechRecognitionCtor = win['SpeechRecognition'] || win['webkitSpeechRecognition']
    if (!SpeechRecognitionCtor) {
      throw new Error('Web Speech API not supported in this browser')
    }

    this.recognition = new (SpeechRecognitionCtor as new () => IWebSpeechRecognition)()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.lang = this.config.language

    this.recognition.onresult = (event: WebSpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0].transcript
        if (result.isFinal) {
          this.emit('recognized', {
            text,
            bookNumber: 0,
            chapter: 0,
            verse: 0,
            confidence: 'fuzzy'
          })
          this.emit('rawRecognized', { text, confidence: result[0].confidence })
        } else {
          this.emit('recognizing', { text })
        }
      }
    }

    this.recognition.onerror = (event: WebSpeechRecognitionErrorEvent) => {
      this.emit('error', { error: new Error(event.error), message: event.error })
    }

    this.recognition.onend = () => {
      this.active = false
      this.emit('sessionStopped', undefined)
    }

    this.recognition.onstart = () => {
      this.active = true
      this.emit('sessionStarted', undefined)
    }

    this.recognition.start()
  }

  async stop(): Promise<void> {
    if (this.recognition) {
      this.recognition.stop()
    }
  }

  isRecognizing(): boolean {
    return this.active
  }

  on<T extends SpeechAdapterEventType>(
    event: T,
    listener: SpeechAdapterEventListener<T>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener as SpeechAdapterEventListener<SpeechAdapterEventType>)
    return () => {
      this.listeners
        .get(event)
        ?.delete(listener as SpeechAdapterEventListener<SpeechAdapterEventType>)
    }
  }

  dispose(): void {
    if (this.recognition) {
      this.recognition.stop()
      this.recognition = null
    }
    this.listeners.clear()
    this.active = false
  }

  private emit<T extends SpeechAdapterEventType>(event: T, data: SpeechAdapterEventMap[T]): void {
    this.listeners.get(event)?.forEach((listener) => {
      listener(data)
    })
  }
}
