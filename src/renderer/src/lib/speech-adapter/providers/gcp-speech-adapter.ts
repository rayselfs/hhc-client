import { loadSpeechKey } from '@renderer/lib/speech-key-storage'
import { getBiblePhrases } from '../bible-phrases'
import type {
  SpeechAdapter,
  SpeechAdapterEventType,
  SpeechAdapterEventListener,
  SpeechAdapterEventMap
} from '../speech-adapter.interface'

export interface GcpSpeechAdapterConfig {
  language: 'cmn-Hant-TW' | 'cmn-Hans-CN'
  maxSessionMs?: number
  idleTimeoutMs?: number
}

export class GcpSpeechAdapter implements SpeechAdapter {
  private mediaRecorder: MediaRecorder | null = null
  private active = false
  private batchIntervalId: ReturnType<typeof setInterval> | null = null
  private listeners: Map<SpeechAdapterEventType, Set<SpeechAdapterEventListener<SpeechAdapterEventType>>> = new Map()
  private config: GcpSpeechAdapterConfig
  private chunks: Blob[] = []
  private stream: MediaStream | null = null

  constructor(config: GcpSpeechAdapterConfig) {
    this.config = config
  }

  async start(): Promise<void> {
    const apiKey = await loadSpeechKey('gcp')
    if (!apiKey) throw new Error('GCP API key not configured')

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: 'audio/webm;codecs=opus' })

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }

    this.active = true
    this.emit('sessionStarted', undefined)

    this.batchIntervalId = setInterval(() => {
      this.flushBatch(apiKey).catch(() => {})
    }, 2000)
    this.mediaRecorder.start(100)
  }

  private async flushBatch(apiKey: string): Promise<void> {
    if (this.chunks.length === 0) return
    const blob = new Blob(this.chunks, { type: 'audio/webm;codecs=opus' })
    this.chunks = []

    const arrayBuffer = await blob.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    const phrases = getBiblePhrases(this.config.language === 'cmn-Hant-TW' ? 'zh-TW' : 'zh-CN')

    const body = {
      config: {
        encoding: 'WEBM_OPUS',
        languageCode: this.config.language,
        speechContexts: phrases.length > 0 ? [{ phrases: phrases.slice(0, 100) }] : undefined
      },
      audio: { content: base64 }
    }

    try {
      const response = await fetch(
        `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      )
      if (!response.ok) return
      const data = await response.json()
      const transcript: string | undefined = data?.results?.[0]?.alternatives?.[0]?.transcript
      if (transcript) {
        this.emit('rawRecognized', { text: transcript, confidence: null })
        this.emit('recognized', {
          text: transcript,
          bookNumber: 0,
          chapter: 0,
          verse: 0,
          confidence: 'fuzzy'
        })
      }
    } catch {
      // silently ignore batch errors
    }
  }

  async stop(): Promise<void> {
    if (this.batchIntervalId) {
      clearInterval(this.batchIntervalId)
      this.batchIntervalId = null
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => {
        t.stop()
      })
      this.stream = null
    }
    this.active = false
    this.emit('sessionStopped', undefined)
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
      this.listeners.get(event)?.delete(listener as SpeechAdapterEventListener<SpeechAdapterEventType>)
    }
  }

  dispose(): void {
    if (this.batchIntervalId) {
      clearInterval(this.batchIntervalId)
      this.batchIntervalId = null
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => {
        t.stop()
      })
      this.stream = null
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
