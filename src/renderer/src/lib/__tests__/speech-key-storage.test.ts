import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isElectron } from '@renderer/lib/env'
import { saveSpeechKey, loadSpeechKey, deleteSpeechKey } from '../speech-key-storage'

vi.mock('@renderer/lib/env', () => ({
  isElectron: vi.fn()
}))

const mockElectronAPI = {
  saveKey: vi.fn(),
  loadKey: vi.fn(),
  deleteKey: vi.fn()
}

describe('speech-key-storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Object.defineProperty(window, 'api', {
      value: { speech: mockElectronAPI },
      writable: true,
      configurable: true
    })
  })

  describe('Browser mode', () => {
    beforeEach(() => {
      vi.mocked(isElectron).mockReturnValue(false)
    })

    it('saveSpeechKey stores key in localStorage', async () => {
      await saveSpeechKey('azure', 'test-key-123')

      expect(localStorage.getItem('hhc-speech-key-azure')).toBe('test-key-123')
    })

    it('loadSpeechKey retrieves key from localStorage', async () => {
      localStorage.setItem('hhc-speech-key-azure', 'stored-key')

      const key = await loadSpeechKey('azure')

      expect(key).toBe('stored-key')
    })

    it('loadSpeechKey returns null when no key exists', async () => {
      const key = await loadSpeechKey('azure')

      expect(key).toBeNull()
    })

    it('deleteSpeechKey removes key from localStorage', async () => {
      localStorage.setItem('hhc-speech-key-azure', 'to-be-deleted')

      await deleteSpeechKey('azure')

      expect(localStorage.getItem('hhc-speech-key-azure')).toBeNull()
    })

    it('saveSpeechKey throws when localStorage fails', async () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceeded')
      })

      await expect(saveSpeechKey('azure', 'test-key')).rejects.toThrow('Failed to save API key')

      spy.mockRestore()
    })

    it('loadSpeechKey returns null when localStorage throws', async () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage error')
      })

      const key = await loadSpeechKey('azure')

      expect(key).toBeNull()

      spy.mockRestore()
    })

    it('deleteSpeechKey throws when localStorage fails', async () => {
      const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('Storage error')
      })

      await expect(deleteSpeechKey('azure')).rejects.toThrow('Failed to delete API key')

      spy.mockRestore()
    })
  })

  describe('Electron mode', () => {
    beforeEach(() => {
      vi.mocked(isElectron).mockReturnValue(true)
    })

    it('saveSpeechKey calls Electron API', async () => {
      mockElectronAPI.saveKey.mockResolvedValue(undefined)

      await saveSpeechKey('azure', 'electron-key')

      expect(mockElectronAPI.saveKey).toHaveBeenCalledWith('azure', 'electron-key')
      expect(localStorage.getItem('hhc-speech-key-azure')).toBeNull()
    })

    it('loadSpeechKey calls Electron API', async () => {
      mockElectronAPI.loadKey.mockResolvedValue('encrypted-key')

      const key = await loadSpeechKey('azure')

      expect(key).toBe('encrypted-key')
      expect(mockElectronAPI.loadKey).toHaveBeenCalledWith('azure')
    })

    it('loadSpeechKey returns null when Electron API returns null', async () => {
      mockElectronAPI.loadKey.mockResolvedValue(null)

      const key = await loadSpeechKey('azure')

      expect(key).toBeNull()
    })

    it('deleteSpeechKey calls Electron API', async () => {
      mockElectronAPI.deleteKey.mockResolvedValue(undefined)

      await deleteSpeechKey('azure')

      expect(mockElectronAPI.deleteKey).toHaveBeenCalledWith('azure')
      expect(localStorage.getItem('hhc-speech-key-azure')).toBeNull()
    })

    it('propagates Electron API errors', async () => {
      mockElectronAPI.saveKey.mockRejectedValue(new Error('Encryption failed'))

      await expect(saveSpeechKey('azure', 'test-key')).rejects.toThrow('Encryption failed')
    })
  })
})
