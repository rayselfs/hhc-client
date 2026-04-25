import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockToastSuccess = vi.fn()
const mockToastWarning = vi.fn()
const mockRetry = vi.fn()
const mockInitialize = vi.fn()
const mockFolderInitialize = vi.fn()
const mockFolderCleanupExpired = vi.fn().mockResolvedValue(undefined)
const mockInitializeSearchIndexes = vi.fn()

const bibleState = {
  isInitialized: false,
  isOffline: false,
  versions: [],
  content: new Map(),
  isLoading: false,
  retry: mockRetry,
  initialize: mockInitialize
}

const folderState = {
  isLoading: false,
  initialize: mockFolderInitialize,
  cleanupExpired: mockFolderCleanupExpired
}

vi.mock('@heroui/react/toast', () => ({
  toast: { success: mockToastSuccess, warning: mockToastWarning }
}))

vi.mock('@renderer/i18n', () => ({
  default: { t: (key: string) => key }
}))

vi.mock('@renderer/stores/bible', () => ({
  useBibleStore: Object.assign(
    (selector: (s: typeof bibleState) => unknown) => selector(bibleState),
    {
      getState: () => bibleState,
      subscribe: vi.fn(() => vi.fn()),
      setState: vi.fn()
    }
  )
}))

vi.mock('@renderer/stores/folder', () => ({
  useBibleFolderStore: Object.assign(
    (selector: (s: typeof folderState) => unknown) => selector(folderState),
    {
      getState: () => folderState,
      subscribe: vi.fn(() => vi.fn())
    }
  )
}))

vi.mock('@renderer/stores/bible-settings', () => ({
  useBibleSettingsStore: Object.assign(vi.fn(), {
    getState: () => ({ selectedVersionId: 1 })
  })
}))

vi.mock('@renderer/lib/bible-search', () => ({
  initializeSearchIndexes: mockInitializeSearchIndexes
}))

describe('initializeApp — online handler', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    bibleState.isOffline = false
    bibleState.isInitialized = false
    const mod = await import('../app-init')
    const cleanup = mod.initializeApp()
    cleanup()
  })

  afterEach(async () => {
    const mod = await import('../app-init')
    mod.initializeApp()()
  })

  it('shows success toast when network comes back online', async () => {
    const { initializeApp } = await import('../app-init')
    const cleanup = initializeApp()

    window.dispatchEvent(new Event('online'))

    expect(mockToastSuccess).toHaveBeenCalledWith('toast.networkRestored')
    cleanup()
  })

  it('calls retry when isOffline is true on coming online', async () => {
    bibleState.isOffline = true
    const { initializeApp } = await import('../app-init')
    const cleanup = initializeApp()

    window.dispatchEvent(new Event('online'))

    expect(mockToastSuccess).toHaveBeenCalledWith('toast.networkRestored')
    expect(mockRetry).toHaveBeenCalled()
    cleanup()
  })

  it('does not call retry when isOffline is false on coming online', async () => {
    bibleState.isOffline = false
    const { initializeApp } = await import('../app-init')
    const cleanup = initializeApp()

    window.dispatchEvent(new Event('online'))

    expect(mockToastSuccess).toHaveBeenCalledWith('toast.networkRestored')
    expect(mockRetry).not.toHaveBeenCalled()
    cleanup()
  })

  it('removes online listener on cleanup', async () => {
    const { initializeApp } = await import('../app-init')
    const cleanup = initializeApp()
    cleanup()

    vi.clearAllMocks()
    window.dispatchEvent(new Event('online'))

    expect(mockToastSuccess).not.toHaveBeenCalled()
  })

  it('shows warning toast when network goes offline', async () => {
    const { initializeApp } = await import('../app-init')
    const cleanup = initializeApp()

    window.dispatchEvent(new Event('offline'))

    expect(mockToastWarning).toHaveBeenCalledWith('toast.networkLost')
    cleanup()
  })

  it('removes offline listener on cleanup', async () => {
    const { initializeApp } = await import('../app-init')
    const cleanup = initializeApp()
    cleanup()

    vi.clearAllMocks()
    window.dispatchEvent(new Event('offline'))

    expect(mockToastWarning).not.toHaveBeenCalled()
  })
})
