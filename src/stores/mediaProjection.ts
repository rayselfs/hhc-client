import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { type AppMessage, type FileItem, MessageType } from '@/types/common'

export const useMediaProjectionStore = defineStore('media-projection', () => {
  // Playlist State
  const playlist = ref<FileItem[]>([])
  const currentIndex = ref(-1)
  const isPresenting = ref(false)
  const showGrid = ref(false) // For 'G' key grid view

  // Media State
  const zoomLevel = ref(1)
  const pan = ref({ x: 0, y: 0 })
  const isPlaying = ref(false)
  const volume = ref(1)
  const pdfPage = ref(1)

  const restartTrigger = ref(0) // increment to trigger restart

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

  // Actions
  const setPlaylist = (items: FileItem[], startIndex = 0) => {
    playlist.value = items
    currentIndex.value = startIndex
    isPresenting.value = true
    resetMediaState()
  }

  const next = () => {
    if (currentIndex.value < playlist.value.length - 1) {
      currentIndex.value++
      resetMediaState()
    }
  }

  const prev = () => {
    if (currentIndex.value > 0) {
      currentIndex.value--
      resetMediaState()
    }
  }

  const jumpTo = (index: number) => {
    if (index >= 0 && index < playlist.value.length) {
      currentIndex.value = index
      showGrid.value = false
      resetMediaState()
    }
  }

  const toggleGrid = () => {
    showGrid.value = !showGrid.value
  }

  const exit = () => {
    isPresenting.value = false
    showGrid.value = false
    playlist.value = []
    currentIndex.value = -1
  }

  // Media Controls
  const resetMediaState = () => {
    zoomLevel.value = 1
    pan.value = { x: 0, y: 0 }
    isPlaying.value = false // Auto-play videos by default?
    pdfPage.value = 1
  }

  const setZoom = (level: number) => {
    zoomLevel.value = Math.max(0.1, Math.min(5, level))
  }

  const setPan = (x: number, y: number) => {
    pan.value = { x, y }
  }

  const setPlaying = (playing: boolean) => {
    isPlaying.value = playing
  }

  const setPdfPage = (page: number) => {
    pdfPage.value = Math.max(1, page)
  }

  const stop = () => {
    isPlaying.value = false
    restartTrigger.value++
  }

  /**
   * 處理媒體投影消息
   */
  const handleMessage = (message: AppMessage): boolean => {
    switch (message.type) {
      case MessageType.MEDIA_UPDATE:
        if (!('action' in message.data)) return false

        if (message.data.action === 'update' && message.data.playlist) {
          // Full playlist update
          setPlaylist(message.data.playlist as FileItem[], message.data.currentIndex)
          return true
        } else if (message.data.action === 'jump') {
          jumpTo(message.data.currentIndex)
          return true
        } else if (message.data.action === 'next') {
          next()
          return true
        } else if (message.data.action === 'prev') {
          prev()
          return true
        }
        break

      case MessageType.MEDIA_CONTROL:
        if (!('action' in message.data)) return false

        if (message.data.action === 'zoom') {
          setZoom(Number(message.data.value))
          return true
        } else if (message.data.action === 'pan') {
          const pan = message.data.value as { x: number; y: number }
          setPan(pan.x, pan.y)
          return true
        } else if (message.data.action === 'play') {
          setPlaying(true)
          return true
        } else if (message.data.action === 'pause') {
          setPlaying(false)
          return true
        } else if (message.data.action === 'pdfPage') {
          setPdfPage(Number(message.data.value))
          return true
        } else if (message.data.action === 'stop') {
          stop()
          return true
        }
        break
    }
    return false
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
    handleMessage,
  }
})
