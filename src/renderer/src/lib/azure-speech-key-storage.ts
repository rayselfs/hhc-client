import { isElectron } from '@renderer/lib/env'

const BROWSER_KEY_STORAGE_NAME = 'hhc-azure-speech-key'

export async function saveAzureSpeechKey(key: string): Promise<void> {
  if (isElectron()) {
    await window.api.azureSpeech.saveKey(key)
  } else {
    try {
      localStorage.setItem(BROWSER_KEY_STORAGE_NAME, key)
    } catch (error) {
      console.error('[Azure Speech] Failed to save key:', error)
      throw new Error('Failed to save API key')
    }
  }
}

export async function loadAzureSpeechKey(): Promise<string | null> {
  if (isElectron()) {
    return await window.api.azureSpeech.loadKey()
  } else {
    try {
      return localStorage.getItem(BROWSER_KEY_STORAGE_NAME)
    } catch (error) {
      console.error('[Azure Speech] Failed to load key:', error)
      return null
    }
  }
}

export async function deleteAzureSpeechKey(): Promise<void> {
  if (isElectron()) {
    await window.api.azureSpeech.deleteKey()
  } else {
    try {
      localStorage.removeItem(BROWSER_KEY_STORAGE_NAME)
    } catch (error) {
      console.error('[Azure Speech] Failed to delete key:', error)
      throw new Error('Failed to delete API key')
    }
  }
}
