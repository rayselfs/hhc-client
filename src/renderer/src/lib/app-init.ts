import { useBibleStore } from '@renderer/stores/bible'
import { useBibleFolderStore } from '@renderer/stores/folder'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { useSettingsStore } from '@renderer/stores/settings'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { initializeSearchIndexes } from '@renderer/lib/bible-search'
import { isElectron } from '@renderer/lib/env'
import { toast } from '@heroui/react/toast'
import i18n from '@renderer/i18n'

let initialized = false

async function initWhisperModelDir(): Promise<void> {
  if (!isElectron()) return
  const { speech, setSpeech } = useSettingsStore.getState()
  const modelDir = speech.whisper.modelDir
  if (!modelDir) return

  const info = await window.api.app.checkWhisperDir(modelDir)
  if (!info.hasFiles) {
    setSpeech({ ...speech, whisper: { ...speech.whisper, modelDir: '', installedModel: null } })
    toast.warning(i18n.t('toast.whisperDirReset' as never))
  } else {
    await window.api.app.setModelDir(modelDir)
  }
}

export function initializeApp(): () => void {
  if (initialized) return () => {}
  initialized = true

  void initWhisperModelDir()

  let prevModelDir = useSettingsStore.getState().speech.whisper.modelDir
  const unsubWhisper = useSettingsStore.subscribe((state) => {
    const modelDir = state.speech.whisper.modelDir
    if (modelDir !== prevModelDir) {
      prevModelDir = modelDir
      if (isElectron() && modelDir) {
        window.api.app.setModelDir(modelDir).catch(() => {})
      }
    }
  })

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

  useFileExplorerStore.getState().initialize()
  useFileExplorerStore.subscribe((state, prev) => {
    if (prev.isLoading && !state.isLoading) {
      void useFileExplorerStore.getState().cleanupExpired()
      const retentionMs = useSettingsStore.getState().trashRetentionDays * 86_400_000
      void useFileExplorerStore.getState().purgeTrash(retentionMs)
    }
  })

  const handleOnline = (): void => {
    toast.success(i18n.t('toast.networkRestored'))
    if (useBibleStore.getState().isOffline) {
      void useBibleStore.getState().retry()
    }
  }

  const handleOffline = (): void => {
    toast.warning(i18n.t('toast.networkLost'))
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    unsubscribe()
    unsubWhisper()
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    initialized = false
    const s = useBibleStore.getState()
    if (s.isLoading && !s.isInitialized) {
      useBibleStore.setState({ isLoading: false })
    }
  }
}
