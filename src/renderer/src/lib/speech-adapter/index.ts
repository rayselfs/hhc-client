import type { SpeechAdapter, SpeechAdapterConfig } from './speech-adapter.interface'
import type { SpeechSettings, SpeechProvider } from '@renderer/stores/settings'

export function createSpeechAdapter(config: SpeechAdapterConfig): Promise<SpeechAdapter>
export function createSpeechAdapter(
  provider: SpeechProvider,
  settings: SpeechSettings,
  opts?: { maxSessionMs?: number }
): Promise<SpeechAdapter>
export async function createSpeechAdapter(
  providerOrConfig: SpeechProvider | SpeechAdapterConfig,
  settings?: SpeechSettings,
  opts?: { maxSessionMs?: number }
): Promise<SpeechAdapter> {
  // Legacy call with SpeechAdapterConfig (azure only)
  if (typeof providerOrConfig === 'object') {
    const { AzureSpeechAdapter } = await import('./providers/azure-speech-adapter')
    return new AzureSpeechAdapter(providerOrConfig)
  }

  const provider = providerOrConfig
  const sp = settings!

  switch (provider) {
    case 'azure': {
      const { AzureSpeechAdapter } = await import('./providers/azure-speech-adapter')
      return new AzureSpeechAdapter({
        subscriptionKey: '',
        region: sp.azure.region,
        language: sp.azure.language,
        maxSessionMs: opts?.maxSessionMs
      })
    }
    case 'gcp': {
      const { GcpSpeechAdapter } = await import('./providers/gcp-speech-adapter')
      return new GcpSpeechAdapter({
        language: sp.gcp.language,
        maxSessionMs: opts?.maxSessionMs
      })
    }
    case 'webSpeech': {
      const { WebSpeechAdapter } = await import('./providers/web-speech-adapter')
      return new WebSpeechAdapter({
        language: sp.azure.language,
        maxSessionMs: opts?.maxSessionMs
      })
    }
    case 'whisper': {
      const { WhisperSpeechAdapter } = await import('./providers/whisper-speech-adapter')
      return new WhisperSpeechAdapter({
        maxSessionMs: opts?.maxSessionMs
      })
    }
  }
}

export type {
  SpeechAdapter,
  SpeechAdapterConfig,
  SpeechRecognizedResult
} from './speech-adapter.interface'
