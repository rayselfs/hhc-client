import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { type AppMessage, MessageType } from '@/types/projection'
import type { FileItem } from '@/types/folder'

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

  // PDF State
  const pdfPageCount = ref(0)
  const pdfViewMode = ref<'slide' | 'scroll'>('slide')

  // Video State
  const currentTime = ref(0)
  const duration = ref(0)
  const isSeeking = ref(false)

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

  /**
   * Format time in MM:SS or HH:MM:SS format
   */
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00'
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formattedCurrentTime = computed(() => formatTime(currentTime.value))
  const formattedDuration = computed(() => formatTime(duration.value))

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
    isPlaying.value = false
    pdfPage.value = 1
    pdfPageCount.value = 0
    pdfViewMode.value = 'slide'
    currentTime.value = 0
    duration.value = 0
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
    const maxPage = pdfPageCount.value > 0 ? pdfPageCount.value : Infinity
    pdfPage.value = Math.max(1, Math.min(page, maxPage))
  }

  const setPdfPageCount = (count: number) => {
    pdfPageCount.value = Math.max(0, count)
  }

  const setPdfViewMode = (mode: 'slide' | 'scroll') => {
    pdfViewMode.value = mode
  }

  const stop = () => {
    isPlaying.value = false
    currentTime.value = 0
    restartTrigger.value++
  }

  const setCurrentTime = (time: number) => {
    currentTime.value = Math.max(0, time)
  }

  const setDuration = (dur: number) => {
    duration.value = Math.max(0, dur)
  }

  const setVolume = (vol: number) => {
    volume.value = Math.max(0, Math.min(1, vol))
  }

  const setIsSeeking = (seeking: boolean) => {
    isSeeking.value = seeking
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
        // ... rest of code

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
        } else if (message.data.action === 'pdfPageCount') {
          setPdfPageCount(Number(message.data.value))
          return true
        } else if (message.data.action === 'pdfViewMode') {
          setPdfViewMode(message.data.value as 'slide' | 'scroll')
          return true
        } else if (message.data.action === 'stop') {
          stop()
          return true
        } else if (message.data.action === 'seek') {
          setCurrentTime(Number(message.data.value))
          return true
        } else if (message.data.action === 'volume') {
          setVolume(Number(message.data.value))
          return true
        } else if (message.data.action === 'timeupdate') {
          setCurrentTime(Number(message.data.value))
          return true
        } else if (message.data.action === 'durationchange') {
          setDuration(Number(message.data.value))
          return true
        } else if (message.data.action === 'seeking-start') {
          setIsSeeking(true)
          return true
        } else if (message.data.action === 'seeking-end') {
          setIsSeeking(false)
          if (message.data.value !== undefined) {
            setCurrentTime(Number(message.data.value))
          }
          return true
        }
        break
    }
    return false
  }

  /**
   * Update notes for the current playlist item
   */
  const updateCurrentItemNotes = (notes: string) => {
    if (currentIndex.value >= 0 && currentIndex.value < playlist.value.length) {
      // Ensure we mutate the reactive array element
      const item = playlist.value[currentIndex.value]
      if (item) {
        item.notes = notes
      }
    }
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
    pdfPageCount,
    pdfViewMode,
    currentTime,
    duration,
    formattedCurrentTime,
    formattedDuration,
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
    setPdfPageCount,
    setPdfViewMode,
    setCurrentTime,
    setDuration,
    setVolume,
    isSeeking,
    setIsSeeking,
    stop,
    updateCurrentItemNotes,
    handleMessage,
  }
})
