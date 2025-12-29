import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { type FileItem } from '@/types/common'
import { useElectron } from '@/composables/useElectron'

export const useMediaProjectionStore = defineStore('media-projection', () => {
  const { mediaCommand, onMediaStateUpdate, mediaGetState } = useElectron()

  // State (Synced from Backend)
  const playlist = ref<FileItem[]>([])
  const currentIndex = ref(-1)
  const isPlaying = ref(false)
  const zoomLevel = ref(1)
  const pan = ref({ x: 0, y: 0 })
  const volume = ref(1)
  const pdfPage = ref(1)
  const showGrid = ref(false)
  const restartTrigger = ref(0) // increment to trigger restart
  const currentTime = ref(0)

  // Local state (that doesn't need strict sync or is strictly local)
  const isPresenting = ref(false) // Whether projection window is active/showing content

  // Getters
  const currentItem = computed(() => {
    if (currentIndex.value >= 0 && currentIndex.value < playlist.value.length) {
      return playlist.value[currentIndex.value]
    }
    return null
  })

  const nextItem = computed(() => {
    if (currentIndex.value + 1 < playlist.value.length) {
      return playlist.value[currentIndex.value + 1]
    }
    return null
  })

  const previousItem = computed(() => {
    if (currentIndex.value - 1 >= 0) {
      return playlist.value[currentIndex.value - 1]
    }
    return null
  })

  // Initialize: Listen for updates
  onMediaStateUpdate((state) => {
    playlist.value = state.playlist
    currentIndex.value = state.currentIndex
    isPlaying.value = state.isPlaying
    zoomLevel.value = state.zoomLevel
    pan.value = state.pan
    volume.value = state.volume
    pdfPage.value = state.pdfPage
    showGrid.value = state.showGrid
    restartTrigger.value = state.restartTrigger
    // Do not overwrite currentTime if we are the ones dragging the slider (handled in component)
    // But for now, simple sync:
    currentTime.value = state.currentTime
  })

  // Initial fetch
  mediaGetState().then((state) => {
    if (state) {
      playlist.value = state.playlist
      currentIndex.value = state.currentIndex
      isPlaying.value = state.isPlaying
      zoomLevel.value = state.zoomLevel
      pan.value = state.pan
      volume.value = state.volume
      pdfPage.value = state.pdfPage
      showGrid.value = state.showGrid
      restartTrigger.value = state.restartTrigger
      currentTime.value = state.currentTime

      if (state.playlist && state.playlist.length > 0) {
        isPresenting.value = true
      }
    }
  })

  // Actions (Send Commands)
  const setPlaylist = (items: FileItem[], startIndex = 0) => {
    // Deep clone to remove Vue Proxies and ensure serializability for IPC
    const serializedPlaylist = JSON.parse(JSON.stringify(items))
    mediaCommand({ action: 'setPlaylist', playlist: serializedPlaylist, startIndex })
    isPresenting.value = true
  }

  const next = () => {
    mediaCommand({ action: 'next' })
  }

  const prev = () => {
    mediaCommand({ action: 'prev' })
  }

  const jumpTo = (index: number) => {
    mediaCommand({ action: 'jump', value: index })
  }

  const toggleGrid = () => {
    mediaCommand({ action: 'toggleGrid' })
  }

  const exit = () => {
    mediaCommand({ action: 'exit' })
    isPresenting.value = false
  }

  const setZoom = (level: number) => {
    mediaCommand({ action: 'setZoom', value: level })
  }

  const setPan = (x: number, y: number) => {
    mediaCommand({ action: 'setPan', value: { x, y } })
  }

  const setPlaying = (playing: boolean) => {
    mediaCommand({ action: playing ? 'play' : 'pause' })
  }

  const setPdfPage = (page: number) => {
    mediaCommand({ action: 'setPdfPage', value: page })
  }

  const stop = () => {
    mediaCommand({ action: 'stop' })
  }

  const seek = (time: number) => {
    mediaCommand({ action: 'seek', value: time })
  }

  // Legacy resetMediaState (might be needed if UI calls it, but backend handles it)
  const resetMediaState = () => {
    // No-op or trigger backend reset if needed?
    // Backend resets on playlist set/jump usually.
  }

  return {
    playlist,
    currentIndex,
    isPresenting,
    showGrid,
    currentItem,
    nextItem,
    previousItem,
    zoomLevel,
    pan,
    isPlaying,
    volume,
    pdfPage,
    restartTrigger,
    currentTime,
    setPlaylist,
    next,
    prev,
    jumpTo,
    toggleGrid,
    exit,
    resetMediaState,
    setZoom,
    setPan,
    setPlaying,
    setPdfPage,
    stop,
    seek,
  }
})
