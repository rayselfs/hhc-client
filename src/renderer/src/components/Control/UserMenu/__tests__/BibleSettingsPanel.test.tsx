import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@renderer/i18n'
import BibleSettingsPanel from '../BibleSettingsPanel'
import { toast } from '@heroui/react/toast'
import * as speechKeyStorage from '@renderer/lib/speech-key-storage'
import { DEFAULT_SPEECH } from '@renderer/stores/settings'
import { ConfirmDialogProvider } from '@renderer/contexts/ConfirmDialogContext'
import ConfirmDialog from '../../../Common/ConfirmDialog'

vi.mock('@heroui/react/toast', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    danger: vi.fn()
  }
}))

vi.mock('@renderer/lib/env', () => ({
  isElectron: vi.fn().mockReturnValue(false)
}))

vi.mock('@renderer/lib/speech-key-storage', () => ({
  saveSpeechKey: vi.fn(),
  loadSpeechKey: vi.fn(),
  deleteSpeechKey: vi.fn()
}))

vi.mock('microsoft-cognitiveservices-speech-sdk', () => ({
  SpeechConfig: {
    fromSubscription: vi.fn(() => ({ speechRecognitionLanguage: '' }))
  },
  SpeechRecognizer: vi.fn().mockImplementation(function () {
    const instance = {
      sessionStarted: null as (() => void) | null,
      canceled: null as (() => void) | null,
      startContinuousRecognitionAsync: vi.fn((onSuccess: () => void) => {
        onSuccess()
        if (instance.sessionStarted) instance.sessionStarted()
      }),
      close: vi.fn()
    }
    return instance
  })
}))

const mockSettingsStore = {
  speech: { ...DEFAULT_SPEECH },
  setSpeech: vi.fn()
}

vi.mock('@renderer/stores/settings', async () => {
  const actual = await vi.importActual('@renderer/stores/settings')
  return {
    ...actual,
    useSettingsStore: vi.fn((selector) =>
      selector ? selector(mockSettingsStore) : mockSettingsStore
    )
  }
})

function renderPanel(): ReturnType<typeof render> {
  return render(
    <ConfirmDialogProvider>
      <BibleSettingsPanel />
      <ConfirmDialog />
    </ConfirmDialogProvider>
  )
}

describe('BibleSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettingsStore.speech = { ...DEFAULT_SPEECH }
    vi.mocked(speechKeyStorage.loadSpeechKey).mockResolvedValue(null)
    vi.mocked(speechKeyStorage.saveSpeechKey).mockResolvedValue(undefined)
    vi.mocked(speechKeyStorage.deleteSpeechKey).mockResolvedValue(undefined)
  })

  it('renders API key input and region select', async () => {
    renderPanel()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter your API key')).toBeInTheDocument()
    })

    expect(screen.getByLabelText('Region')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('Test Connection')).toBeInTheDocument()
  })

  it('loads existing API key on mount', async () => {
    vi.mocked(speechKeyStorage.loadSpeechKey).mockResolvedValue('existing-key')

    renderPanel()

    await waitFor(() => {
      const input = screen.getByPlaceholderText('Enter your API key') as HTMLInputElement
      expect(input.value).toBe('existing-key')
    })
  })

  it('loads existing region from settings', async () => {
    mockSettingsStore.speech = {
      ...DEFAULT_SPEECH,
      azure: { ...DEFAULT_SPEECH.azure, region: 'westus2' }
    }

    renderPanel()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter your API key')).toBeInTheDocument()
    })
  })

  it('toggles API key visibility', async () => {
    const user = userEvent.setup()
    renderPanel()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter your API key')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Enter your API key') as HTMLInputElement
    expect(input.type).toBe('password')

    const toggleButton = screen.getByLabelText('Show')
    await user.click(toggleButton)

    expect(input.type).toBe('text')

    await user.click(toggleButton)
    expect(input.type).toBe('password')
  })

  it('saves API key and region after successful test', async () => {
    const user = userEvent.setup()
    renderPanel()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter your API key')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Enter your API key')
    await user.type(input, 'new-api-key')

    const testButton = screen.getByText('Test Connection')
    await user.click(testButton)

    await waitFor(() => {
      expect(vi.mocked(toast).success).toHaveBeenCalledWith('Connection test successful')
    })

    const saveButton = screen.getByText('Save')
    await user.click(saveButton)

    await waitFor(() => {
      expect(vi.mocked(speechKeyStorage.saveSpeechKey)).toHaveBeenCalledWith('azure', 'new-api-key')
      expect(mockSettingsStore.setSpeech).toHaveBeenCalledWith(
        expect.objectContaining({ azure: expect.objectContaining({ region: 'eastasia' }) })
      )
      expect(vi.mocked(toast).success).toHaveBeenCalledWith('Azure Speech settings saved')
    })
  })

  it('disables save when clearing existing key without re-testing', async () => {
    const user = userEvent.setup()
    vi.mocked(speechKeyStorage.loadSpeechKey).mockResolvedValue('existing-key')
    mockSettingsStore.speech = {
      ...DEFAULT_SPEECH,
      azure: { ...DEFAULT_SPEECH.azure, region: 'eastasia' }
    }

    renderPanel()

    await waitFor(() => {
      const input = screen.getByPlaceholderText('Enter your API key') as HTMLInputElement
      expect(input.value).toBe('existing-key')
    })

    const input = screen.getByPlaceholderText('Enter your API key')
    await user.clear(input)

    const saveButton = screen.getByText('Save')
    expect(saveButton).toBeDisabled()
  })

  it('shows error toast when save fails', async () => {
    const user = userEvent.setup()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(speechKeyStorage.saveSpeechKey).mockRejectedValue(new Error('Save failed'))

    renderPanel()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter your API key')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Enter your API key')
    await user.type(input, 'test-key')

    const testButton = screen.getByText('Test Connection')
    await user.click(testButton)

    await waitFor(() => {
      expect(vi.mocked(toast).success).toHaveBeenCalledWith('Connection test successful')
    })

    const saveButton = screen.getByText('Save')
    await user.click(saveButton)

    await waitFor(() => {
      expect(vi.mocked(toast).danger).toHaveBeenCalledWith('Failed to save Azure Speech settings')
    })
    expect(consoleError).toHaveBeenCalledWith(
      '[BibleSettings] Failed to save Azure settings:',
      expect.any(Error)
    )
    consoleError.mockRestore()
  })

  it('disables save button when no changes', async () => {
    vi.mocked(speechKeyStorage.loadSpeechKey).mockResolvedValue('existing-key')
    mockSettingsStore.speech = {
      ...DEFAULT_SPEECH,
      azure: { ...DEFAULT_SPEECH.azure, region: 'eastasia' }
    }

    renderPanel()

    await waitFor(() => {
      const input = screen.getByPlaceholderText('Enter your API key') as HTMLInputElement
      expect(input.value).toBe('existing-key')
    })

    const saveButton = screen.getByText('Save')
    expect(saveButton).toBeDisabled()
  })

  it('disables test button when no API key', async () => {
    renderPanel()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter your API key')).toBeInTheDocument()
    })

    const testButton = screen.getByText('Test Connection')
    expect(testButton).toBeDisabled()
  })

  it('disables test button while loading', async () => {
    vi.mocked(speechKeyStorage.loadSpeechKey).mockReturnValue(new Promise(() => {}))
    renderPanel()

    const testButton = screen.getByText('Test Connection')
    expect(testButton).toBeDisabled()
  })
})
