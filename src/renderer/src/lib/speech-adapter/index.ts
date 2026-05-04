import type { SpeechAdapter, SpeechAdapterConfig } from './speech-adapter.interface'
import type { SpeechSettings, SpeechProvider } from '@renderer/stores/settings'
import { AzureSpeechAdapter } from './providers/azure-speech-adapter'
import { GcpSpeechAdapter } from './providers/gcp-speech-adapter'
import { WebSpeechAdapter } from './providers/web-speech-adapter'
import { WhisperSpeechAdapter } from './providers/whisper-speech-adapter'

export function createSpeechAdapter(config: SpeechAdapterConfig): SpeechAdapter
export function createSpeechAdapter(
  provider: SpeechProvider,
  settings: SpeechSettings,
  opts?: { maxSessionMs?: number }
): SpeechAdapter
export function createSpeechAdapter(
  providerOrConfig: SpeechProvider | SpeechAdapterConfig,
  settings?: SpeechSettings,
  opts?: { maxSessionMs?: number }
): SpeechAdapter {
  // Legacy call with SpeechAdapterConfig (azure only)
  if (typeof providerOrConfig === 'object') {
    return new AzureSpeechAdapter(providerOrConfig)
  }

  const provider = providerOrConfig
  const sp = settings!

  switch (provider) {
    case 'azure':
      return new AzureSpeechAdapter({
        subscriptionKey: '',
        region: sp.azure.region,
        language: sp.azure.language,
        maxSessionMs: opts?.maxSessionMs
      })
    case 'gcp':
      return new GcpSpeechAdapter({
        language: sp.gcp.language,
        maxSessionMs: opts?.maxSessionMs
      })
    case 'webSpeech':
      return new WebSpeechAdapter({
        language: sp.azure.language,
        maxSessionMs: opts?.maxSessionMs
      })
    case 'whisper':
      return new WhisperSpeechAdapter({
        maxSessionMs: opts?.maxSessionMs
      })
  }
}

export { AzureSpeechAdapter }

export type {
  SpeechAdapter,
  SpeechAdapterConfig,
  SpeechRecognizedResult
} from './speech-adapter.interface'
