import type { AzureSpeechConfig, AzureSpeechEventData } from '@shared/types/azure-speech'

export interface SpeechAdapter {
  start(config: AzureSpeechConfig): Promise<void>
  stop(): Promise<void>
  isRecognizing(): Promise<boolean>
  onEvent(callback: (event: AzureSpeechEventData) => void): () => void
  dispose(): void
}

export class ElectronSpeechAdapter implements SpeechAdapter {
  private unsubscribers: Array<() => void> = []

  async start(config: AzureSpeechConfig): Promise<void> {
    await window.api.azureSpeech.start(config)
  }

  async stop(): Promise<void> {
    await window.api.azureSpeech.stop()
  }

  async isRecognizing(): Promise<boolean> {
    return await window.api.azureSpeech.isRecognizing()
  }

  onEvent(callback: (event: AzureSpeechEventData) => void): () => void {
    const unsubscribe = window.api.azureSpeech.onEvent(callback)
    this.unsubscribers.push(unsubscribe)
    return unsubscribe
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
  }
}
