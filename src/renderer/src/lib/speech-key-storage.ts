import { isElectron } from '@renderer/lib/env'

const BROWSER_KEY_PREFIX = 'hhc-speech-key'

export async function saveSpeechKey(provider: string, key: string): Promise<void> {
  if (isElectron()) {
    await window.api.speech.saveKey(provider, key)
  } else {
    try {
      localStorage.setItem(`${BROWSER_KEY_PREFIX}-${provider}`, key)
    } catch (error) {
      console.error(`[Speech] Failed to save key for ${provider}:`, error)
      throw new Error('Failed to save API key')
    }
  }
}

export async function loadSpeechKey(provider: string): Promise<string | null> {
  if (isElectron()) {
    return await window.api.speech.loadKey(provider)
  } else {
    try {
      return localStorage.getItem(`${BROWSER_KEY_PREFIX}-${provider}`)
    } catch (error) {
      console.error(`[Speech] Failed to load key for ${provider}:`, error)
      return null
    }
  }
}

export async function deleteSpeechKey(provider: string): Promise<void> {
  if (isElectron()) {
    await window.api.speech.deleteKey(provider)
  } else {
    try {
      localStorage.removeItem(`${BROWSER_KEY_PREFIX}-${provider}`)
    } catch (error) {
      console.error(`[Speech] Failed to delete key for ${provider}:`, error)
      throw new Error('Failed to delete API key')
    }
  }
}
