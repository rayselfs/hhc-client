import type { SpeechAdapter, SpeechAdapterConfig } from './speech-adapter.interface'
import { BrowserSpeechAdapter } from './browser-speech-adapter'

export function createSpeechAdapter(config: SpeechAdapterConfig): SpeechAdapter {
  return new BrowserSpeechAdapter(config)
}

export type {
  SpeechAdapter,
  SpeechAdapterConfig,
  SpeechRecognizedResult
} from './speech-adapter.interface'
