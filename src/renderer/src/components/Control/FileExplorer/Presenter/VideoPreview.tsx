import React, { useEffect, useRef, useState } from 'react'
import { toast } from '@heroui/react/toast'
import { useTranslation } from 'react-i18next'
import type { FileItemRecord } from '@shared/types/folder'
import { openFileExplorerDB, getFileBlob } from '@renderer/lib/file-explorer-db'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

interface VideoPreviewProps {
  item: FileItemRecord
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function VideoPreview({ item }: VideoPreviewProps): React.JSX.Element {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(false)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false

    async function load(): Promise<void> {
      const db = await openFileExplorerDB()
      const blob = await getFileBlob(db, item.id)
      if (cancelled) return
      if (!blob) {
        setError(true)
        toast.warning(t('fileExplorer.blobLoadFailed'))
        const store = useMediaProjectionStore.getState()
        if (store.canNext()) {
          store.next()
        } else {
          store.exit()
        }
        return
      }
      objectUrl = URL.createObjectURL(blob)
      setVideoSrc(objectUrl)
    }

    void load()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setVideoSrc(null)
      const video = videoRef.current
      if (video) video.pause()
    }
  }, [item.id, t])

  useEffect(() => {
    const handleTogglePlay = (): void => {
      if (!videoRef.current) return
      if (videoRef.current.paused) {
        videoRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch((err: unknown) => {
            console.error('Video play error:', err)
          })
      } else {
        videoRef.current.pause()
        setIsPlaying(false)
      }
    }
    window.addEventListener('media:togglePlay', handleTogglePlay)
    return () => window.removeEventListener('media:togglePlay', handleTogglePlay)
  }, [])

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="text-white/50 text-center">{t('presenter.videoLoadFailed')}</div>
      </div>
    )
  }

  const handlePlayPause = (): void => {
    window.dispatchEvent(new CustomEvent('media:togglePlay'))
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (!videoRef.current) return
    const time = Number(e.target.value)
    videoRef.current.currentTime = time
    setCurrentTime(time)
    window.dispatchEvent(new CustomEvent('media:seek', { detail: { time } }))
  }

  return (
    <div className="w-full h-full flex flex-col bg-black">
      <div className="flex-1 overflow-hidden flex items-center justify-center">
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            muted
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
            onDurationChange={() => setDuration(videoRef.current?.duration ?? 0)}
            onEnded={() => setIsPlaying(false)}
          />
        ) : (
          <div className="w-full h-full" />
        )}
      </div>
      <div className="flex items-center gap-2 px-3 py-2 bg-black/80">
        <button
          type="button"
          onClick={handlePlayPause}
          className="text-white/80 hover:text-white text-sm px-1"
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={duration}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="flex-1 h-1 cursor-pointer"
        />
        <span className="text-white/60 text-xs tabular-nums">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  )
}
