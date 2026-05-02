import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isElectron } from '@renderer/lib/env'
import {
  saveAzureSpeechKey,
  loadAzureSpeechKey,
  deleteAzureSpeechKey
} from '../azure-speech-key-storage'

vi.mock('@renderer/lib/env', () => ({
  isElectron: vi.fn()
}))

const mockElectronAPI = {
  saveKey: vi.fn(),
  loadKey: vi.fn(),
  deleteKey: vi.fn()
}

describe('azure-speech-key-storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Object.defineProperty(window, 'api', {
      value: { azureSpeech: mockElectronAPI },
      writable: true,
      configurable: true
    })
  })

  describe('Browser mode', () => {
    beforeEach(() => {
      vi.mocked(isElectron).mockReturnValue(false)
    })

    it('saveAzureSpeechKey stores key in localStorage', async () => {
      await saveAzureSpeechKey('test-key-123')

      expect(localStorage.getItem('hhc-azure-speech-key')).toBe('test-key-123')
    })

    it('loadAzureSpeechKey retrieves key from localStorage', async () => {
      localStorage.setItem('hhc-azure-speech-key', 'stored-key')

      const key = await loadAzureSpeechKey()

      expect(key).toBe('stored-key')
    })

    it('loadAzureSpeechKey returns null when no key exists', async () => {
      const key = await loadAzureSpeechKey()

      expect(key).toBeNull()
    })

    it('deleteAzureSpeechKey removes key from localStorage', async () => {
      localStorage.setItem('hhc-azure-speech-key', 'to-be-deleted')

      await deleteAzureSpeechKey()

      expect(localStorage.getItem('hhc-azure-speech-key')).toBeNull()
    })

    it('saveAzureSpeechKey throws when localStorage fails', async () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceeded')
      })

      await expect(saveAzureSpeechKey('test-key')).rejects.toThrow('Failed to save API key')

      spy.mockRestore()
    })

    it('loadAzureSpeechKey returns null when localStorage throws', async () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage error')
      })

      const key = await loadAzureSpeechKey()

      expect(key).toBeNull()

      spy.mockRestore()
    })

    it('deleteAzureSpeechKey throws when localStorage fails', async () => {
      const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('Storage error')
      })

      await expect(deleteAzureSpeechKey()).rejects.toThrow('Failed to delete API key')

      spy.mockRestore()
    })
  })

  describe('Electron mode', () => {
    beforeEach(() => {
      vi.mocked(isElectron).mockReturnValue(true)
    })

    it('saveAzureSpeechKey calls Electron API', async () => {
      mockElectronAPI.saveKey.mockResolvedValue(undefined)

      await saveAzureSpeechKey('electron-key')

      expect(mockElectronAPI.saveKey).toHaveBeenCalledWith('electron-key')
      expect(localStorage.getItem('hhc-azure-speech-key')).toBeNull()
    })

    it('loadAzureSpeechKey calls Electron API', async () => {
      mockElectronAPI.loadKey.mockResolvedValue('encrypted-key')

      const key = await loadAzureSpeechKey()

      expect(key).toBe('encrypted-key')
      expect(mockElectronAPI.loadKey).toHaveBeenCalled()
    })

    it('loadAzureSpeechKey returns null when Electron API returns null', async () => {
      mockElectronAPI.loadKey.mockResolvedValue(null)

      const key = await loadAzureSpeechKey()

      expect(key).toBeNull()
    })

    it('deleteAzureSpeechKey calls Electron API', async () => {
      mockElectronAPI.deleteKey.mockResolvedValue(undefined)

      await deleteAzureSpeechKey()

      expect(mockElectronAPI.deleteKey).toHaveBeenCalled()
      expect(localStorage.getItem('hhc-azure-speech-key')).toBeNull()
    })

    it('propagates Electron API errors', async () => {
      mockElectronAPI.saveKey.mockRejectedValue(new Error('Encryption failed'))

      await expect(saveAzureSpeechKey('test-key')).rejects.toThrow('Encryption failed')
    })
  })
})
