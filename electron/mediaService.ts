import { BrowserWindow, ipcMain } from 'electron'
import type { FileItem } from '../src/types/common'

export interface MediaState {
  playlist: FileItem[]
  currentIndex: number
  isPlaying: boolean
  zoomLevel: number
  pan: { x: number; y: number }
  volume: number
  pdfPage: number
  showGrid: boolean
  restartTrigger: number
  currentTime: number
}

export interface MediaCommand {
  action:
    | 'play'
    | 'pause'
    | 'stop'
    | 'next'
    | 'prev'
    | 'jump'
    | 'setPlaylist'
    | 'setZoom'
    | 'setPan'
    | 'setPdfPage'
    | 'toggleGrid'
    | 'exit'
    | 'seek'
  value?: unknown
  playlist?: FileItem[]
  startIndex?: number
}

export class MediaService {
  private state: MediaState
  private windows: BrowserWindow[] = []

  constructor() {
    this.state = {
      playlist: [],
      currentIndex: -1,
      isPlaying: false,
      zoomLevel: 1,
      pan: { x: 0, y: 0 },
      volume: 1,
      pdfPage: 1,
      showGrid: false,
      restartTrigger: 0,
      currentTime: 0,
    }
  }

  registerWindow(window: BrowserWindow) {
    if (!this.windows.includes(window)) {
      this.windows.push(window)
    }
  }

  unregisterWindow(window: BrowserWindow) {
    this.windows = this.windows.filter((w) => w !== window && !w.isDestroyed())
  }

  private broadcast() {
    this.windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send('media-state-update', this.state)
      }
    })
  }

  handleCommand(command: MediaCommand) {
    switch (command.action) {
      case 'setPlaylist':
        if (command.playlist) {
          this.state.playlist = command.playlist
          this.state.currentIndex = command.startIndex ?? 0
          this.state.isPlaying = false
          this.resetMediaState()
          this.state.showGrid = false
        }
        break

      case 'play':
        this.state.isPlaying = true
        break

      case 'pause':
        this.state.isPlaying = false
        break

      case 'stop':
        this.state.isPlaying = false
        this.state.restartTrigger++
        break

      case 'next':
        if (this.state.currentIndex < this.state.playlist.length - 1) {
          this.state.currentIndex++
          this.resetMediaState()
        }
        break

      case 'prev':
        if (this.state.currentIndex > 0) {
          this.state.currentIndex--
          this.resetMediaState()
        }
        break

      case 'jump':
        if (typeof command.value === 'number') {
          if (command.value >= 0 && command.value < this.state.playlist.length) {
            this.state.currentIndex = command.value
            this.state.showGrid = false
            this.resetMediaState()
          }
        }
        break

      case 'seek':
        if (typeof command.value === 'number') {
          this.state.currentTime = command.value
        }
        break

      case 'setZoom':
        if (typeof command.value === 'number') {
          this.state.zoomLevel = Math.max(0.1, Math.min(5, command.value))
        }
        break

      case 'setPan':
        if (command.value && typeof command.value === 'object') {
          const pan = command.value as { x: number; y: number }
          this.state.pan = pan
        }
        break

      case 'setPdfPage':
        if (typeof command.value === 'number') {
          this.state.pdfPage = Math.max(1, command.value)
        }
        break

      case 'toggleGrid':
        this.state.showGrid = !this.state.showGrid
        break

      case 'exit':
        this.state.playlist = []
        this.state.currentIndex = -1
        this.state.isPlaying = false
        this.state.showGrid = false
        break
    }

    this.broadcast()
  }

  private resetMediaState() {
    this.state.zoomLevel = 1
    this.state.pan = { x: 0, y: 0 }
    this.state.isPlaying = false
    this.state.pdfPage = 1
    this.state.currentTime = 0
    // Does NOT increment restartTrigger automatically on next/prev, but usually next/prev loads new item so video starts at 0.
  }

  getState(): MediaState {
    return { ...this.state }
  }

  registerIpcHandlers() {
    ipcMain.on('media-command', (event, command: MediaCommand) => {
      try {
        this.handleCommand(command)
      } catch (error) {
        console.error('Media command error:', error)
      }
    })

    ipcMain.handle('media-get-state', async () => {
      return this.getState()
    })
  }

  cleanup() {
    this.windows = []
  }
}
