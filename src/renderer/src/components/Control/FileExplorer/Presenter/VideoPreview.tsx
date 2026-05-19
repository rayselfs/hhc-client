import React, { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '@heroui/react/toast'
import { useTranslation } from 'react-i18next'
import { Play, Pause, RotateCcw, Volume1, Volume2, VolumeX } from 'lucide-react'
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
  const [error, setError] = useState(false)

  const [hasStarted, setHasStarted] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isEnded, setIsEnded] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isVolumeHovered, setIsVolumeHovered] = useState(false)
  const [isDraggingSeek, setIsDraggingSeek] = useState(false)
  const [localSeekTime, setLocalSeekTime] = useState(0)

  const hasStartedRef = useRef(false)

  const zoomLevel = useMediaProjectionStore((s) => s.zoomLevel)
  const pan = useMediaProjectionStore((s) => s.pan)
  const transform =
    zoomLevel !== 1
      ? `scale(${zoomLevel}) translate(${(pan.x / zoomLevel) * 100}%, ${(pan.y / zoomLevel) * 100}%)`
      : undefined

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

  const handlePlayPause = useCallback((): void => {
    if (!videoRef.current) return
    if (isEnded) {
      videoRef.current.currentTime = 0
      videoRef.current
        .play()
        .then(() => {
          setIsEnded(false)
          setIsPlaying(true)
        })
        .catch(() => {})
      window.dispatchEvent(new CustomEvent('media:seek', { detail: { time: 0 } }))
      window.dispatchEvent(new CustomEvent('media:play'))
    } else if (isPlaying) {
      videoRef.current.pause()
      window.dispatchEvent(new CustomEvent('media:pause'))
    } else {
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {})
      window.dispatchEvent(new CustomEvent('media:play'))
    }
  }, [isEnded, isPlaying])

  useEffect(() => {
    const handleTogglePlay = (): void => {
      if (!hasStartedRef.current) {
        hasStartedRef.current = true
        setHasStarted(true)
      }
      handlePlayPause()
    }
    window.addEventListener('media:togglePlay', handleTogglePlay)
    return () => window.removeEventListener('media:togglePlay', handleTogglePlay)
  }, [handlePlayPause])

  const handleVolumeChange = useCallback((val: number): void => {
    setVolume(val)
    setIsMuted(val === 0)
    window.dispatchEvent(new CustomEvent('media:volumeChange', { detail: { volume: val } }))
  }, [])

  const handleVolumeIconClick = useCallback((): void => {
    const newMuted = !isMuted
    setIsMuted(newMuted)
    const effectiveVol = newMuted ? 0 : volume || 0.8
    window.dispatchEvent(
      new CustomEvent('media:volumeChange', { detail: { volume: effectiveVol } })
    )
  }, [isMuted, volume])

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="text-white/50 text-center">{t('presenter.videoLoadFailed')}</div>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative bg-black">
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform,
          transformOrigin: 'center center',
          transition: 'transform 0.15s ease'
        }}
      >
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            muted
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
            onDurationChange={() => setDuration(videoRef.current?.duration ?? 0)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false)
              setIsEnded(true)
            }}
          />
        ) : (
          <div className="w-full h-full" />
        )}
      </div>

      {!hasStarted && (
        <button
          className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
          onClick={() => {
            hasStartedRef.current = true
            setHasStarted(true)
            handlePlayPause()
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="rounded-full p-4" style={{ background: 'var(--presenter-overlay-bg)' }}>
            <Play size={40} className="text-white" />
          </div>
        </button>
      )}

      {hasStarted && isEnded && (
        <button
          className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
          onClick={handlePlayPause}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="rounded-full p-4" style={{ background: 'var(--presenter-overlay-bg)' }}>
            <RotateCcw size={40} className="text-white" />
          </div>
        </button>
      )}

      {hasStarted && !isEnded && (
        <button
          className="absolute inset-0 z-10 cursor-pointer"
          aria-label="Toggle play"
          onClick={handlePlayPause}
          onMouseDown={(e) => e.stopPropagation()}
        />
      )}

      {hasStarted && (
        <div
          className="absolute bottom-0 left-0 right-0 z-20"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={isDraggingSeek ? localSeekTime : currentTime}
            className="w-full cursor-pointer accent-white px-2"
            style={{ height: '4px' }}
            onMouseDown={() => {
              setIsDraggingSeek(true)
              setLocalSeekTime(currentTime)
            }}
            onChange={(e) => setLocalSeekTime(Number(e.target.value))}
            onMouseUp={(e) => {
              const seekTo = Number((e.target as HTMLInputElement).value)
              setIsDraggingSeek(false)
              if (videoRef.current) videoRef.current.currentTime = seekTo
              window.dispatchEvent(new CustomEvent('media:seek', { detail: { time: seekTo } }))
            }}
          />

          <div className="flex justify-start pl-2 pb-2">
            <div
              className="inline-flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full"
              style={{ background: 'var(--presenter-overlay-bg)' }}
            >
              <button
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition-colors"
                onClick={handlePlayPause}
              >
                {isEnded ? (
                  <RotateCcw size={22} />
                ) : isPlaying ? (
                  <Pause size={22} />
                ) : (
                  <Play size={22} />
                )}
              </button>

              <div
                className={`flex items-center transition-all ${isVolumeHovered ? 'rounded-full px-1 bg-black/20' : ''}`}
                onMouseEnter={() => setIsVolumeHovered(true)}
                onMouseLeave={() => setIsVolumeHovered(false)}
              >
                <button
                  className="text-white/80 hover:text-white p-1"
                  onClick={handleVolumeIconClick}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX size={22} />
                  ) : volume < 0.4 ? (
                    <Volume1 size={22} />
                  ) : (
                    <Volume2 size={22} />
                  )}
                </button>
                <div
                  className="flex items-center"
                  style={{
                    width: isVolumeHovered ? '80px' : '0',
                    overflow: 'hidden',
                    transition: 'width 0.25s ease',
                    opacity: isVolumeHovered ? 1 : 0
                  }}
                >
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    className="vol-range w-full cursor-pointer"
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  />
                </div>
              </div>

              <span className="text-white/60 text-sm tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
