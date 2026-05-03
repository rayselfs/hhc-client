import * as sdk from 'microsoft-cognitiveservices-speech-sdk'
import { parseVerseReference } from '../verse-parser'
import { matchBookName } from '../bible-book-matcher'
import type {
  SpeechAdapter,
  SpeechAdapterConfig,
  SpeechAdapterEventType,
  SpeechAdapterEventListener,
  SpeechAdapterEventMap,
  SpeechRecognizedResult
} from './speech-adapter.interface'

export class BrowserSpeechAdapter implements SpeechAdapter {
  private recognizer: sdk.SpeechRecognizer | null = null
  private isActive = false
  private listeners: Map<SpeechAdapterEventType, Set<SpeechAdapterEventListener<any>>> = new Map()
  private config: SpeechAdapterConfig
  private onlineHandler: (() => void) | null = null
  private offlineHandler: (() => void) | null = null
  private incompleteBuffer = ''
  private bufferTimer: ReturnType<typeof setTimeout> | null = null
  private readonly BUFFER_TIMEOUT = 5000

  private static readonly WATCHDOG_INTERVAL = 30_000
  private static readonly DEFAULT_IDLE_TIMEOUT_MS = 3 * 60 * 1000
  private static readonly DEFAULT_MAX_SESSION_MS = 60 * 60 * 1000
  private static readonly MAX_CONSECUTIVE_ERRORS = 3
  private watchdogTimer: ReturnType<typeof setInterval> | null = null
  private lastActivityTime = 0
  private sessionStartTime = 0
  private consecutiveErrors = 0
  private idleTimeoutMs: number
  private maxSessionMs: number
  private beforeUnloadHandler: (() => void) | null = null

  constructor(config: SpeechAdapterConfig) {
    this.config = config
    this.idleTimeoutMs = config.idleTimeoutMs ?? BrowserSpeechAdapter.DEFAULT_IDLE_TIMEOUT_MS
    this.maxSessionMs = config.maxSessionMs ?? BrowserSpeechAdapter.DEFAULT_MAX_SESSION_MS
    this.setupNetworkListeners()
    this.setupBeforeUnloadHandler()
  }

  private setupBeforeUnloadHandler(): void {
    this.beforeUnloadHandler = () => {
      if (this.isActive && this.recognizer) {
        this.recognizer.stopContinuousRecognitionAsync(
          () => {},
          () => {}
        )
        this.recognizer.close()
        this.isActive = false
      }
    }
    window.addEventListener('beforeunload', this.beforeUnloadHandler)
  }

  private recordActivity(): void {
    this.lastActivityTime = Date.now()
    this.consecutiveErrors = 0
  }

  private startWatchdog(): void {
    this.lastActivityTime = Date.now()
    this.sessionStartTime = Date.now()
    this.consecutiveErrors = 0
    this.stopWatchdog()
    this.watchdogTimer = setInterval(() => {
      const now = Date.now()
      if (now - this.sessionStartTime >= this.maxSessionMs) {
        this.emit('maxDurationReached', undefined)
        this.stop().catch(() => {})
        return
      }
      if (now - this.lastActivityTime >= this.idleTimeoutMs) {
        this.emit('idleTimeout', undefined)
        this.stop().catch(() => {})
      }
    }, BrowserSpeechAdapter.WATCHDOG_INTERVAL)
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer)
      this.watchdogTimer = null
    }
  }

  private handleCancellationError(errorDetails: string): void {
    this.consecutiveErrors++
    const message =
      this.consecutiveErrors >= BrowserSpeechAdapter.MAX_CONSECUTIVE_ERRORS
        ? `Recognition stopped after ${this.consecutiveErrors} consecutive errors: ${errorDetails}`
        : errorDetails
    this.emit('error', { error: new Error(message), message })
    if (this.consecutiveErrors >= BrowserSpeechAdapter.MAX_CONSECUTIVE_ERRORS) {
      this.stopWatchdog()
    }
  }

  private setupNetworkListeners(): void {
    this.onlineHandler = () => {
      if (!this.isActive && this.recognizer) {
        this.emit('error', {
          error: new Error('Network connection restored'),
          message: 'Network connection restored. Please restart recognition.'
        })
      }
    }

    this.offlineHandler = () => {
      if (this.isActive) {
        this.stop().catch(() => {})
        this.emit('error', {
          error: new Error('Network connection lost'),
          message: 'Network connection lost. Recognition stopped.'
        })
      }
    }

    window.addEventListener('online', this.onlineHandler)
    window.addEventListener('offline', this.offlineHandler)
  }

  async start(): Promise<void> {
    if (this.isActive) {
      throw new Error('Recognition already active')
    }

    if (!navigator.onLine) {
      throw new Error('No network connection')
    }

    try {
      const speechConfig = sdk.SpeechConfig.fromSubscription(
        this.config.subscriptionKey,
        this.config.region
      )

      const language = this.config.language || this.detectLanguage()
      speechConfig.speechRecognitionLanguage = language

      speechConfig.setServiceProperty(
        'InitialSilenceTimeoutMs',
        '5000',
        sdk.ServicePropertyChannel.UriQueryParameter
      )
      speechConfig.setServiceProperty(
        'EndSilenceTimeoutMs',
        '600',
        sdk.ServicePropertyChannel.UriQueryParameter
      )

      const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput()
      this.recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig)

      this.recognizer.recognizing = (_s, e) => {
        if (e.result.reason === sdk.ResultReason.RecognizingSpeech) {
          this.recordActivity()
          this.emit('recognizing', { text: e.result.text })
        }
      }

      this.recognizer.recognized = (_s, e) => {
        if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
          this.recordActivity()
          const text = e.result.text
          console.log('[Adapter] Azure recognized:', text)
          this.handleRecognizedText(text)
        }
      }

      this.recognizer.sessionStarted = () => {
        this.emit('sessionStarted', undefined)
      }

      this.recognizer.sessionStopped = () => {
        this.isActive = false
        this.emit('sessionStopped', undefined)
      }

      this.recognizer.canceled = (_s, e) => {
        this.isActive = false
        const reason = sdk.CancellationReason[e.reason]
        this.emit('canceled', { reason })

        if (e.reason === sdk.CancellationReason.Error) {
          this.handleCancellationError(e.errorDetails)
        }
      }

      this.recognizer.startContinuousRecognitionAsync(
        () => {
          this.isActive = true
          this.startWatchdog()
        },
        (err) => {
          this.emit('error', {
            error: new Error(err),
            message: `Failed to start recognition: ${err}`
          })
        }
      )
    } catch (error) {
      this.emit('error', {
        error: error as Error,
        message: `Failed to initialize recognizer: ${(error as Error).message}`
      })
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.recognizer || !this.isActive) {
      return
    }

    this.clearBuffer()
    this.stopWatchdog()

    return new Promise((resolve, reject) => {
      this.recognizer!.stopContinuousRecognitionAsync(
        () => {
          this.isActive = false
          resolve()
        },
        (err) => {
          this.isActive = false
          reject(new Error(err))
        }
      )
    })
  }

  isRecognizing(): boolean {
    return this.isActive
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
    this.clearBuffer()
    this.stopWatchdog()

    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler)
      this.beforeUnloadHandler = null
    }

    if (this.recognizer) {
      this.recognizer.close()
      this.recognizer = null
    }

    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler)
      this.onlineHandler = null
    }

    if (this.offlineHandler) {
      window.removeEventListener('offline', this.offlineHandler)
      this.offlineHandler = null
    }

    this.listeners.clear()
    this.isActive = false
  }

  private detectLanguage(): string {
    const locale = navigator.language || 'en-US'
    if (locale.startsWith('zh-TW')) return 'zh-TW'
    if (locale.startsWith('zh-CN')) return 'zh-CN'
    if (locale.startsWith('zh')) return 'zh-TW'
    if (locale.startsWith('en')) return 'en-US'
    return 'en-US'
  }

  private parseAndMatch(text: string): SpeechRecognizedResult | null {
    const parsed = parseVerseReference(text)
    if (!parsed) return null

    const match = matchBookName(parsed.book)
    if (!match) return null

    return {
      text,
      bookNumber: match.bookNumber,
      chapter: parsed.chapter,
      verse: parsed.verse,
      confidence: match.confidence
    }
  }

  private stripPunctuation(text: string): string {
    return text.replace(/[。，、！？.,!?；：…]/g, '')
  }

  private clearBuffer(): void {
    this.incompleteBuffer = ''
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer)
      this.bufferTimer = null
    }
  }

  private handleRecognizedText(text: string): void {
    let parsed = this.parseAndMatch(text)
    if (parsed) {
      console.log('[Adapter] Parse succeeded:', parsed)
      this.clearBuffer()
      this.emit('recognized', parsed)
      return
    }

    if (this.incompleteBuffer) {
      const combined = this.stripPunctuation(this.incompleteBuffer) + this.stripPunctuation(text)
      console.log('[Adapter] Trying buffer combination:', combined)
      parsed = this.parseAndMatch(combined)
      if (parsed) {
        console.log('[Adapter] Buffer combination succeeded:', parsed)
        this.clearBuffer()
        this.emit('recognized', parsed)
        return
      }
    }

    console.warn('[Adapter] Parse failed, buffering:', text)
    this.clearBuffer()
    this.incompleteBuffer = text
    this.bufferTimer = setTimeout(() => {
      console.log('[Adapter] Buffer expired, clearing:', this.incompleteBuffer)
      this.incompleteBuffer = ''
      this.bufferTimer = null
    }, this.BUFFER_TIMEOUT)
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
