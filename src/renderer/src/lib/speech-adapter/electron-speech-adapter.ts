import type { AzureSpeechConfig, AzureSpeechEventData } from '@shared/types/azure-speech'
import type {
  SpeechAdapter,
  SpeechAdapterConfig,
  SpeechAdapterEventType,
  SpeechAdapterEventListener,
  SpeechAdapterEventMap,
  SpeechRecognizedResult
} from './speech-adapter.interface'

export class ElectronSpeechAdapter implements SpeechAdapter {
  private unsubscribers: Array<() => void> = []
  private listeners: Map<SpeechAdapterEventType, Set<SpeechAdapterEventListener<any>>> = new Map()
  private config: SpeechAdapterConfig | null = null

  async start(): Promise<void> {
    if (!this.config) {
      throw new Error('Config not set. Use ElectronSpeechAdapter constructor with config.')
    }

    const azureConfig: AzureSpeechConfig = {
      apiKey: this.config.subscriptionKey,
      region: this.config.region,
      language: this.config.language || 'en-US'
    }

    const unsubscribe = window.api.azureSpeech.onEvent((event: AzureSpeechEventData) => {
      this.handleEvent(event)
    })
    this.unsubscribers.push(unsubscribe)

    await window.api.azureSpeech.start(azureConfig)
  }

  async stop(): Promise<void> {
    await window.api.azureSpeech.stop()
  }

  isRecognizing(): boolean {
    return false
  }

  on<T extends SpeechAdapterEventType>(
    event: T,
    listener: SpeechAdapterEventListener<T>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)

    return () => {
      const eventListeners = this.listeners.get(event)
      if (eventListeners) {
        eventListeners.delete(listener)
      }
    }
  }

  dispose(): void {
    this.unsubscribers.forEach((unsubscribe) => {
      try {
        unsubscribe()
      } catch (error) {
        console.error('[ElectronSpeechAdapter] Error during cleanup:', error)
      }
    })
    this.unsubscribers = []
    this.listeners.clear()
  }

  constructor(config: SpeechAdapterConfig) {
    this.config = config
  }

  private handleEvent(event: AzureSpeechEventData): void {
    switch (event.type) {
      case 'recognizing':
        if (event.data && typeof event.data.text === 'string') {
          this.emit('recognizing', { text: event.data.text })
        }
        break
      case 'recognized':
        if (
          event.data &&
          typeof event.data.text === 'string' &&
          typeof event.data.bookNumber === 'number' &&
          typeof event.data.chapter === 'number' &&
          typeof event.data.verse === 'number' &&
          typeof event.data.confidence === 'string'
        ) {
          const result: SpeechRecognizedResult = {
            text: event.data.text,
            bookNumber: event.data.bookNumber,
            chapter: event.data.chapter,
            verse: event.data.verse,
            confidence: event.data.confidence as 'exact' | 'pinyin' | 'fuzzy'
          }
          this.emit('recognized', result)
        }
        break
      case 'sessionStarted':
        this.emit('sessionStarted', undefined)
        break
      case 'sessionStopped':
        this.emit('sessionStopped', undefined)
        break
      case 'canceled':
        this.emit('canceled', {
          reason: (event.data?.reason as string) || 'Unknown'
        })
        break
      case 'error':
        this.emit('error', {
          error: new Error((event.data?.message as string) || event.error || 'Unknown error'),
          message: (event.data?.message as string) || event.error || 'Unknown error'
        })
        break
    }
  }

  private emit<T extends SpeechAdapterEventType>(event: T, data: SpeechAdapterEventMap[T]): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach((listener) => {
        listener(data)
      })
    }
  }
}
