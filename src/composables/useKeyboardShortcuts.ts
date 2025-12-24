import { onMounted, onBeforeUnmount, type Ref } from 'vue'
import { useProjectionStore } from '@/stores/projection'
import { useTimerStore } from '@/stores/timer'
import { useProjectionMessaging } from '@/composables/useProjectionMessaging'
import { useMemoryManager } from '@/utils/memoryManager'

export interface KeyboardShortcutOptions {
  currentView?: Ref<string> | string
  onCopy?: () => void
  onPaste?: () => void
  onCut?: () => void
  onDelete?: () => void
}

export function useKeyboardShortcuts(
  optionsOrView?: Ref<string> | string | KeyboardShortcutOptions,
) {
  // Normalize options
  const options: KeyboardShortcutOptions =
    typeof optionsOrView === 'object' && 'onCopy' in (optionsOrView as object)
      ? (optionsOrView as KeyboardShortcutOptions)
      : { currentView: optionsOrView as Ref<string> | string }

  const { currentView, onCopy, onPaste, onCut, onDelete } = options
  const projectionStore = useProjectionStore()
  const timerStore = useTimerStore()
  const { setProjectionState } = useProjectionMessaging()
  const { track, untrack, cleanup } = useMemoryManager('useKeyboardShortcuts')

  // Handle keyboard events
  const handleKeydown = (event: KeyboardEvent) => {
    // Avoid triggering shortcuts in input fields
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    // Check if Mac system
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

    // Projection shortcuts
    if (isMac) {
      // Mac: Command + Shift + Enter
      if (event.metaKey && event.shiftKey && event.key === 'Enter') {
        event.preventDefault()
        toggleProjection()
      }
    } else {
      // Windows: F5
      if (event.key === 'F5') {
        event.preventDefault()
        toggleProjection()
      }
    }

    // Cancel projection shortcut (Ctrl+Q for both Windows and Mac)
    if (event.ctrlKey && event.key === 'q') {
      // Respond to Control + Q only when projection is open (not showing default)
      if (!projectionStore.isShowingDefault) {
        event.preventDefault()
        closeProjection()
      }
    }

    // Timer shortcuts (only respond in Timer page)
    const view = typeof currentView === 'string' ? currentView : currentView?.value
    if (view === 'timer') {
      switch (event.code) {
        case 'Space':
          event.preventDefault()
          switch (timerStore.state) {
            case 'running':
              // Running -> Pause
              timerStore.pauseTimer()
              break
            case 'paused':
              // Paused -> Resume
              timerStore.resumeTimer()
              break
            case 'stopped':
              // Stopped -> Start
              timerStore.startTimer()
              break
          }
          break

        case 'KeyR':
          event.preventDefault()
          timerStore.resetTimer()
          break
      }
    }

    // Generic Shortcuts (Copy, Cut, Paste, Delete)
    // Ctrl+C / Cmd+C
    if ((event.metaKey || event.ctrlKey) && event.key === 'c') {
      if (onCopy) {
        event.preventDefault()
        onCopy()
      }
    }

    // Ctrl+V / Cmd+V
    if ((event.metaKey || event.ctrlKey) && event.key === 'v') {
      if (onPaste) {
        event.preventDefault()
        onPaste()
      }
    }

    // Ctrl+X / Cmd+X
    if ((event.metaKey || event.ctrlKey) && event.key === 'x') {
      if (onCut) {
        event.preventDefault()
        onCut()
      }
    }

    // Delete / Backspace (Backspace only on Mac usually for delete file, but Delete is standard)
    if (event.key === 'Delete' || (isMac && event.metaKey && event.key === 'Backspace')) {
      // Only trigger delete if not in an input, which is already handled at the top
      if (onDelete) {
        event.preventDefault()
        onDelete()
      }
    }
  }

  // Toggle projection state
  const toggleProjection = async () => {
    const newShowDefault = !projectionStore.isShowingDefault
    // setProjectionState automatically checks and creates projection window
    await setProjectionState(newShowDefault)
  }

  // Close projection
  const closeProjection = async () => {
    if (!projectionStore.isShowingDefault) {
      await setProjectionState(true)
    }
  }

  // Lifecycle management
  onMounted(() => {
    // Track event listener
    track('keydown-listener', 'listener', {
      element: document,
      event: 'keydown',
      handler: handleKeydown,
    })
    document.addEventListener('keydown', handleKeydown)
  })

  onBeforeUnmount(() => {
    // Cleanup event listener
    untrack('keydown-listener')
    document.removeEventListener('keydown', handleKeydown)

    // Cleanup memory
    cleanup()
  })

  return {
    toggleProjection,
    closeProjection,
  }
}
