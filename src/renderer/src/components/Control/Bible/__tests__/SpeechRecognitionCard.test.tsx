import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import SpeechRecognitionCard from '../SpeechRecognitionCard'
import { createSpeechAdapter } from '@renderer/lib/speech-adapter'
import { loadAzureSpeechKey } from '@renderer/lib/azure-speech-key-storage'
import { useSettingsStore } from '@renderer/stores/settings'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { useBibleStore } from '@renderer/stores/bible'
import type { SpeechAdapter } from '@renderer/lib/speech-adapter'
import type { BibleBook } from '@shared/types/bible'

vi.mock('@renderer/lib/speech-adapter')
vi.mock('@renderer/lib/azure-speech-key-storage')
vi.mock('@renderer/stores/settings')
vi.mock('@renderer/stores/bible-settings')
vi.mock('@renderer/stores/bible')

const mockUseTranslation = vi.fn()
vi.mock('react-i18next', () => ({
  useTranslation: () => mockUseTranslation(),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn()
  }
}))

describe('SpeechRecognitionCard', () => {
  let mockAdapter: SpeechAdapter
  let eventListeners: Record<string, (data: unknown) => void>
  let mockSettingsState: { azureSpeech: { region: string } }
  let mockBibleSettingsState: { selectedVersionId: number }
  let mockBibleState: { content: Map<number, BibleBook[]> }

  beforeEach(() => {
    eventListeners = {}

    mockUseTranslation.mockReturnValue({
      t: (key: string) => key,
      i18n: { language: 'en' }
    })

    mockAdapter = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      isRecognizing: vi.fn().mockReturnValue(false),
      on: vi.fn((event, handler) => {
        eventListeners[event] = handler
        return vi.fn()
      }),
      dispose: vi.fn()
    }

    vi.mocked(createSpeechAdapter).mockReturnValue(mockAdapter)
    vi.mocked(loadAzureSpeechKey).mockResolvedValue('mock-api-key')

    mockSettingsState = { azureSpeech: { region: 'eastasia' } }
    vi.mocked(useSettingsStore).mockImplementation((selector: unknown) => {
      return selector
        ? (selector as (s: typeof mockSettingsState) => unknown)(mockSettingsState)
        : mockSettingsState
    })

    mockBibleSettingsState = { selectedVersionId: 1 }
    vi.mocked(useBibleSettingsStore).mockImplementation((selector: unknown) => {
      return selector
        ? (selector as (s: typeof mockBibleSettingsState) => unknown)(mockBibleSettingsState)
        : mockBibleSettingsState
    })

    const mockBibleContent = new Map<number, BibleBook[]>()
    mockBibleContent.set(1, [
      {
        number: 44,
        code: 'Act',
        name: 'Acts',
        abbreviation: 'Acts',
        chapters: [
          {
            number: 1,
            verses: [
              { id: 1, number: 1, text: 'The former account I made...' },
              { id: 2, number: 2, text: 'Until the day in which...' }
            ]
          }
        ]
      }
    ])

    mockBibleState = { content: mockBibleContent }
    vi.mocked(useBibleStore).mockImplementation((selector: unknown) => {
      return selector
        ? (selector as (s: typeof mockBibleState) => unknown)(mockBibleState)
        : mockBibleState
    })

    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render with correct header and buttons', () => {
      render(<SpeechRecognitionCard />)

      expect(screen.getByText('bible.speech.title')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /bible.speech.start/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /bible.speech.clear/i })).toBeInTheDocument()
    })

    it('should disable start button when Azure config is missing', async () => {
      vi.mocked(loadAzureSpeechKey).mockResolvedValue(null)

      render(<SpeechRecognitionCard />)

      const startButton = screen.getByRole('button', { name: /bible.speech.start/i })
      expect(startButton).toBeDisabled()
    })

    it('should disable start button when region is missing', () => {
      mockSettingsState.azureSpeech.region = ''

      render(<SpeechRecognitionCard />)

      const startButton = screen.getByRole('button', { name: /bible.speech.start/i })
      expect(startButton).toBeDisabled()
    })

    it('should disable start button when offline', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      })

      render(<SpeechRecognitionCard />)

      const startButton = screen.getByRole('button', { name: /bible.speech.start/i })
      expect(startButton).toBeDisabled()
    })
  })

  describe('Recognition Lifecycle', () => {
    it('should start recognition when start button is clicked', async () => {
      render(<SpeechRecognitionCard />)

      const startButton = screen.getByRole('button', { name: /bible.speech.start/i })
      fireEvent.click(startButton)

      await waitFor(() => {
        expect(loadAzureSpeechKey).toHaveBeenCalled()
        expect(createSpeechAdapter).toHaveBeenCalledWith({
          subscriptionKey: 'mock-api-key',
          region: 'eastasia',
          language: 'en-US'
        })
        expect(mockAdapter.start).toHaveBeenCalled()
      })

      // Button text should change to "stop"
      expect(screen.getByRole('button', { name: /bible.speech.stop/i })).toBeInTheDocument()
    })

    it('should stop recognition when stop button is clicked', async () => {
      render(<SpeechRecognitionCard />)

      // Start recognition first
      const startButton = screen.getByRole('button', { name: /bible.speech.start/i })
      fireEvent.click(startButton)

      await waitFor(() => {
        expect(mockAdapter.start).toHaveBeenCalled()
      })

      // Stop recognition
      const stopButton = screen.getByRole('button', { name: /bible.speech.stop/i })
      fireEvent.click(stopButton)

      await waitFor(() => {
        expect(mockAdapter.stop).toHaveBeenCalled()
        expect(mockAdapter.dispose).toHaveBeenCalled()
      })

      // Button text should change back to "start"
      expect(screen.getByRole('button', { name: /bible.speech.start/i })).toBeInTheDocument()
    })

    it('should show error when recognition start fails', async () => {
      vi.mocked(mockAdapter.start).mockRejectedValue(new Error('Microphone access denied'))

      render(<SpeechRecognitionCard />)

      const startButton = screen.getByRole('button', { name: /bible.speech.start/i })
      fireEvent.click(startButton)

      await waitFor(() => {
        expect(screen.getByText(/bible.speech.error.start-failed/i)).toBeInTheDocument()
      })
    })

    it('should automatically stop recognition on network offline', async () => {
      render(<SpeechRecognitionCard />)

      // Start recognition
      const startButton = screen.getByRole('button', { name: /bible.speech.start/i })
      fireEvent.click(startButton)

      await waitFor(() => {
        expect(mockAdapter.start).toHaveBeenCalled()
      })

      // Simulate network offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      })
      window.dispatchEvent(new Event('offline'))

      await waitFor(() => {
        expect(mockAdapter.stop).toHaveBeenCalled()
        expect(screen.getByText(/bible.speech.error.network-offline/i)).toBeInTheDocument()
      })
    })
  })

  describe('Recognition Results', () => {
    it('should display recognized verse (newest on top)', async () => {
      render(<SpeechRecognitionCard />)

      // Start recognition
      const startButton = screen.getByRole('button', { name: /bible.speech.start/i })
      fireEvent.click(startButton)

      await waitFor(() => {
        expect(mockAdapter.start).toHaveBeenCalled()
      })

      // Simulate recognition result
      eventListeners.recognized('使徒行傳1章1節')

      await waitFor(() => {
        expect(screen.getByText('Acts 1:1')).toBeInTheDocument()
        expect(screen.getByText('The former account I made...')).toBeInTheDocument()
      })

      // Add another verse
      eventListeners.recognized('使徒行傳1章2節')

      await waitFor(() => {
        const verseItems = screen.getAllByText(/Acts 1/)
        expect(verseItems[0]).toHaveTextContent('Acts 1:2') // Newest on top
        expect(verseItems[1]).toHaveTextContent('Acts 1:1')
      })
    })

    it('should handle verse not found in store', async () => {
      render(<SpeechRecognitionCard />)

      // Start recognition
      const startButton = screen.getByRole('button', { name: /bible.speech.start/i })
      fireEvent.click(startButton)

      await waitFor(() => {
        expect(mockAdapter.start).toHaveBeenCalled()
      })

      // Simulate recognition result for a verse not in the mock store
      eventListeners.recognized('創世記1章1節')

      // Should not add item if book not found in content
      await waitFor(() => {
        expect(screen.queryByText('Genesis 1:1')).not.toBeInTheDocument()
      })
    })

    it('should ignore invalid recognition text', async () => {
      render(<SpeechRecognitionCard />)

      // Start recognition
      const startButton = screen.getByRole('button', { name: /bible.speech.start/i })
      fireEvent.click(startButton)

      await waitFor(() => {
        expect(mockAdapter.start).toHaveBeenCalled()
      })

      // Simulate invalid recognition result
      eventListeners.recognized('hello world')

      // Should not add any items
      await waitFor(() => {
        expect(screen.queryByText('hello world')).not.toBeInTheDocument()
      })
    })
  })

  describe('Verse Item Actions', () => {
    it('should dispatch preview event when verse item is clicked', async () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')

      render(<SpeechRecognitionCard />)

      // Start recognition and add a verse
      const startButton = screen.getByRole('button', { name: /bible.speech.start/i })
      fireEvent.click(startButton)

      await waitFor(() => {
        expect(mockAdapter.start).toHaveBeenCalled()
      })

      eventListeners.recognized('使徒行傳1章1節')

      await waitFor(() => {
        expect(screen.getByText('Acts 1:1')).toBeInTheDocument()
      })

      // Click the verse item
      const verseItem = screen.getByText('Acts 1:1').closest('div')!
      fireEvent.click(verseItem)

      await waitFor(() => {
        expect(dispatchEventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'bible:preview',
            detail: expect.objectContaining({
              bookNumber: 44,
              chapter: 1,
              verse: 1
            })
          })
        )
      })

      dispatchEventSpy.mockRestore()
    })

    it('should delete verse item when delete button is clicked', async () => {
      render(<SpeechRecognitionCard />)

      // Start recognition and add a verse
      const startButton = screen.getByRole('button', { name: /bible.speech.start/i })
      fireEvent.click(startButton)

      await waitFor(() => {
        expect(mockAdapter.start).toHaveBeenCalled()
      })

      eventListeners.recognized('使徒行傳1章1節')

      await waitFor(() => {
        expect(screen.getByText('Acts 1:1')).toBeInTheDocument()
      })

      // Click delete button
      const deleteButton = screen.getByRole('button', { name: /common.delete/i })
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(screen.queryByText('Acts 1:1')).not.toBeInTheDocument()
      })
    })

    it('should clear all verses when clear button is clicked', async () => {
      render(<SpeechRecognitionCard />)

      // Start recognition and add verses
      const startButton = screen.getByRole('button', { name: /bible.speech.start/i })
      fireEvent.click(startButton)

      await waitFor(() => {
        expect(mockAdapter.start).toHaveBeenCalled()
      })

      eventListeners.recognized('使徒行傳1章1節')
      eventListeners.recognized('使徒行傳1章2節')

      await waitFor(() => {
        expect(screen.getByText('Acts 1:1')).toBeInTheDocument()
        expect(screen.getByText('Acts 1:2')).toBeInTheDocument()
      })

      // Click clear button
      const clearButton = screen.getByRole('button', { name: /bible.speech.clear/i })
      fireEvent.click(clearButton)

      await waitFor(() => {
        expect(screen.queryByText('Acts 1:1')).not.toBeInTheDocument()
        expect(screen.queryByText('Acts 1:2')).not.toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should show config-required error when API key is missing', async () => {
      vi.mocked(loadAzureSpeechKey).mockResolvedValue(null)

      render(<SpeechRecognitionCard />)

      const startButton = screen.getByRole('button', { name: /bible.speech.start/i })
      fireEvent.click(startButton)

      await waitFor(() => {
        expect(screen.getByText(/bible.speech.error.config-required/i)).toBeInTheDocument()
      })
    })

    it('should handle recognition error event', async () => {
      render(<SpeechRecognitionCard />)

      // Start recognition
      const startButton = screen.getByRole('button', { name: /bible.speech.start/i })
      fireEvent.click(startButton)

      await waitFor(() => {
        expect(mockAdapter.start).toHaveBeenCalled()
      })

      // Simulate error event
      eventListeners.error({ message: 'Speech service error' })

      await waitFor(() => {
        expect(screen.getByText(/Speech service error/i)).toBeInTheDocument()
      })
    })

    it('should handle sessionStopped event', async () => {
      render(<SpeechRecognitionCard />)

      // Start recognition
      const startButton = screen.getByRole('button', { name: /bible.speech.start/i })
      fireEvent.click(startButton)

      await waitFor(() => {
        expect(mockAdapter.start).toHaveBeenCalled()
      })

      // Simulate sessionStopped event
      eventListeners.sessionStopped({})

      await waitFor(() => {
        expect(mockAdapter.dispose).toHaveBeenCalled()
        // Button should change back to "start"
        expect(screen.getByRole('button', { name: /bible.speech.start/i })).toBeInTheDocument()
      })
    })
  })

  describe('Language Support', () => {
    it('should use zh-TW locale for Traditional Chinese', async () => {
      mockUseTranslation.mockReturnValue({
        t: (key: string) => key,
        i18n: { language: 'zh-TW' }
      })

      render(<SpeechRecognitionCard />)

      const startButton = screen.getByRole('button', { name: /bible.speech.start/i })
      fireEvent.click(startButton)

      await waitFor(() => {
        expect(createSpeechAdapter).toHaveBeenCalledWith(
          expect.objectContaining({
            language: 'zh-TW'
          })
        )
      })
    })

    it('should use zh-CN locale for Simplified Chinese', async () => {
      mockUseTranslation.mockReturnValue({
        t: (key: string) => key,
        i18n: { language: 'zh-CN' }
      })

      render(<SpeechRecognitionCard />)

      const startButton = screen.getByRole('button', { name: /bible.speech.start/i })
      fireEvent.click(startButton)

      await waitFor(() => {
        expect(createSpeechAdapter).toHaveBeenCalledWith(
          expect.objectContaining({
            language: 'zh-CN'
          })
        )
      })
    })

    it('should use en-US locale for English', async () => {
      mockUseTranslation.mockReturnValue({
        t: (key: string) => key,
        i18n: { language: 'en' }
      })

      render(<SpeechRecognitionCard />)

      const startButton = screen.getByRole('button', { name: /bible.speech.start/i })
      fireEvent.click(startButton)

      await waitFor(() => {
        expect(createSpeechAdapter).toHaveBeenCalledWith(
          expect.objectContaining({
            language: 'en-US'
          })
        )
      })
    })
  })

  describe('Cleanup', () => {
    it('should cleanup adapter on unmount', async () => {
      const { unmount } = render(<SpeechRecognitionCard />)

      // Start recognition
      const startButton = screen.getByRole('button', { name: /bible.speech.start/i })
      fireEvent.click(startButton)

      await waitFor(() => {
        expect(mockAdapter.start).toHaveBeenCalled()
      })

      // Unmount component
      unmount()

      await waitFor(() => {
        expect(mockAdapter.dispose).toHaveBeenCalled()
      })
    })

    it('should remove network event listeners on unmount', async () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

      const { unmount } = render(<SpeechRecognitionCard />)

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))

      removeEventListenerSpy.mockRestore()
    })
  })
})
