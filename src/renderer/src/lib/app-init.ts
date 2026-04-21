import { useBibleStore } from '@renderer/stores/bible'
import { useBibleFolderStore } from '@renderer/stores/folder'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { initializeSearchIndexes } from '@renderer/lib/bible-search'

let initialized = false

export function initializeApp(): () => void {
  if (initialized) return () => {}
  initialized = true

  const tryInitSearch = (state: ReturnType<typeof useBibleStore.getState>): void => {
    if (!state.isInitialized || state.versions.length === 0) return
    const selectedVersionId =
      useBibleSettingsStore.getState().selectedVersionId || state.versions[0].id
    initializeSearchIndexes(state.content, state.versions, selectedVersionId)
  }

  const unsubscribe = useBibleStore.subscribe((state, prev) => {
    if (!prev.isInitialized && state.isInitialized) {
      tryInitSearch(state)
    }
  })

  const current = useBibleStore.getState()
  if (current.isInitialized) {
    tryInitSearch(current)
  } else {
    useBibleStore.getState().initialize()
  }

  useBibleFolderStore.getState().initialize()
  useBibleFolderStore.subscribe((state, prev) => {
    if (prev.isLoading && !state.isLoading) {
      void useBibleFolderStore.getState().cleanupExpired()
    }
  })

  return () => {
    unsubscribe()
    initialized = false
    // Reset loading state so StrictMode re-mount can re-initialize
    const s = useBibleStore.getState()
    if (s.isLoading && !s.isInitialized) {
      useBibleStore.setState({ isLoading: false })
    }
  }
}
