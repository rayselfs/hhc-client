/**
 * Azure Speech Recognition types and constants.
 */

export interface AzureSpeechConfig {
  language: string
  region: string
  apiKey: string
}

export interface AzureSpeechRecognitionResult {
  text: string
  reason: 'RecognizedSpeech' | 'NoMatch' | 'InitialSilenceTimeout' | 'BabbleTimeout'
  confidence?: number
}

export type AzureSpeechEventType =
  | 'recognizing'
  | 'recognized'
  | 'sessionStarted'
  | 'sessionStopped'
  | 'canceled'
  | 'error'

export interface AzureSpeechEventData {
  type: AzureSpeechEventType
  data?: Record<string, unknown>
  error?: string
}

export interface AzureSpeechState {
  isRecognizing: boolean
  isConnected: boolean
}
