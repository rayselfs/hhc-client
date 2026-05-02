import { isElectron } from '../env'
import type { SpeechAdapter, SpeechAdapterConfig } from './speech-adapter.interface'
import { BrowserSpeechAdapter } from './browser-speech-adapter'
import { ElectronSpeechAdapter } from './electron-speech-adapter'

export function createSpeechAdapter(config: SpeechAdapterConfig): SpeechAdapter {
  if (isElectron()) {
    return new ElectronSpeechAdapter(config)
  }
  return new BrowserSpeechAdapter(config)
}

export type {
  SpeechAdapter,
  SpeechAdapterConfig,
  SpeechRecognizedResult
} from './speech-adapter.interface'
