import React, { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '@heroui/react/toast'
import { useTranslation } from 'react-i18next'
import {
  Play,
  Pause,
  ArrowCounterClockwise,
  SpeakerHigh,
  SpeakerLow,
  SpeakerX
} from '@phosphor-icons/react'
import type { FileItemRecord } from '@shared/types/folder'
import { getFileSource, openFileExplorerDB } from '@renderer/lib/file-explorer-db'
import { getBlobId } from '@renderer/lib/blob-identity'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { usePresenterCommands } from '@renderer/contexts/PresenterCommandContext'
import PreviewLoadError from './PreviewLoadError'

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
  const { sendCommand } = usePresenterCommands()
  const videoRef = useRef<HTMLVideoElement>(null)
  const seekInputRef = useRef<HTMLInputElement>(null)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [retryToken, setRetryToken] = useState(0)
  const blobId = getBlobId(item)

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
  const [flashState, setFlashState] = useState<{ icon: 'play' | 'pause'; key: number } | null>(null)

  const hasStartedRef = useRef(false)
  const playbackStateRef = useRef({ hasStarted: false, isPlaying: false, isEnded: false })
  const currentTimeRef = useRef(0)
  const durationRef = useRef(0)
  const isDraggingSeekRef = useRef(false)
  const localSeekTimeRef = useRef(0)
  const volumeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashKeyRef = useRef(0)

  const zoomLevel = useMediaProjectionStore((s) => s.zoomLevel)
  const pan = useMediaProjectionStore((s) => s.pan)
  const setTypeState = useMediaProjectionStore((s) => s.setTypeState)
  const transform =
    zoomLevel !== 1
      ? `scale(${zoomLevel}) translate(${(pan.x / zoomLevel) * 100}%, ${(pan.y / zoomLevel) * 100}%)`
      : undefined

  const setPlaybackState = useCallback(
    (next: { hasStarted?: boolean; isPlaying?: boolean; isEnded?: boolean }): void => {
      const current = playbackStateRef.current
      const resolved = {
        hasStarted: next.hasStarted ?? current.hasStarted,
        isPlaying: next.isPlaying ?? current.isPlaying,
        isEnded: next.isEnded ?? current.isEnded
      }
      playbackStateRef.current = resolved
      hasStartedRef.current = resolved.hasStarted
      setHasStarted(resolved.hasStarted)
      setIsPlaying(resolved.isPlaying)
      setIsEnded(resolved.isEnded)
      setTypeState('video', resolved)
    },
    [setTypeState]
  )

  useEffect(() => {
    playbackStateRef.current = { hasStarted: false, isPlaying: false, isEnded: false }
    hasStartedRef.current = false
    setTypeState('video', { hasStarted: false, isPlaying: false, isEnded: false })
  }, [item.id, setTypeState])

  useEffect(() => {
    let revokeSource: (() => void) | null = null
    let cancelled = false

    async function load(): Promise<void> {
      setError(false)
      const db = await openFileExplorerDB()
      const source = await getFileSource(db, blobId, item.mimeType)
      if (cancelled) {
        source?.revoke()
        return
      }
      if (!source) {
        setError(true)
        toast.warning(t('fileExplorer.blobLoadFailed'))
        return
      }
      revokeSource = source.revoke
      setVideoSrc(source.url)
    }

    void load()
    return () => {
      cancelled = true
      revokeSource?.()
      setVideoSrc(null)
      isDraggingSeekRef.current = false
      setIsDraggingSeek(false)
      if (volumeDebounceRef.current) clearTimeout(volumeDebounceRef.current)
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)
    }
  }, [blobId, item.mimeType, retryToken, t])

  const triggerFlash = useCallback((icon: 'play' | 'pause'): void => {
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)
    flashKeyRef.current += 1
    setFlashState({ icon, key: flashKeyRef.current })
    flashTimeoutRef.current = setTimeout(() => setFlashState(null), 1100)
  }, [])

  const handlePlayPause = useCallback((): void => {
    if (!videoRef.current) return
    if (isEnded) {
      triggerFlash('play')
      videoRef.current.currentTime = 0
      setPlaybackState({ hasStarted: true, isPlaying: true, isEnded: false })
      videoRef.current
        .play()
        .then(() => setPlaybackState({ hasStarted: true, isPlaying: true, isEnded: false }))
        .catch(() => setPlaybackState({ isPlaying: false }))
      sendCommand({ action: 'seek', itemId: item.id, value: 0 })
      sendCommand({ action: 'play', itemId: item.id })
    } else if (isPlaying) {
      triggerFlash('pause')
      setPlaybackState({ isPlaying: false })
      videoRef.current.pause()
      sendCommand({ action: 'pause', itemId: item.id })
    } else {
      if (hasStartedRef.current) triggerFlash('play')
      setPlaybackState({ hasStarted: true, isPlaying: true, isEnded: false })
      videoRef.current
        .play()
        .then(() => setPlaybackState({ hasStarted: true, isPlaying: true, isEnded: false }))
        .catch(() => setPlaybackState({ isPlaying: false }))
      sendCommand({ action: 'play', itemId: item.id })
    }
  }, [isEnded, isPlaying, item.id, sendCommand, setPlaybackState, triggerFlash])

  const pauseVideo = useCallback((): void => {
    if (!videoRef.current || !isPlaying) return
    triggerFlash('pause')
    setPlaybackState({ isPlaying: false })
    videoRef.current.pause()
    sendCommand({ action: 'pause', itemId: item.id })
  }, [isPlaying, item.id, sendCommand, setPlaybackState, triggerFlash])

  useEffect(() => {
    const handleTogglePlay = (): void => {
      handlePlayPause()
    }
    window.addEventListener('media:togglePlay', handleTogglePlay)
    window.addEventListener('media:pauseVideo', pauseVideo)
    return () => {
      window.removeEventListener('media:togglePlay', handleTogglePlay)
      window.removeEventListener('media:pauseVideo', pauseVideo)
    }
  }, [handlePlayPause, pauseVideo])

  const handleVolumeChange = useCallback(
    (val: number): void => {
      setVolume(val)
      setIsMuted(val === 0)
      if (volumeDebounceRef.current) clearTimeout(volumeDebounceRef.current)
      volumeDebounceRef.current = setTimeout(() => {
        sendCommand({ action: 'volume', itemId: item.id, value: val })
      }, 100)
    },
    [item.id, sendCommand]
  )

  const handleVolumeIconClick = useCallback((): void => {
    const newMuted = !isMuted
    setIsMuted(newMuted)
    const effectiveVol = newMuted ? 0 : volume || 0.8
    if (volumeDebounceRef.current) clearTimeout(volumeDebounceRef.current)
    volumeDebounceRef.current = setTimeout(() => {
      sendCommand({ action: 'volume', itemId: item.id, value: effectiveVol })
    }, 100)
  }, [isMuted, item.id, volume, sendCommand])

  const commitSeek = useCallback(
    (seekTo: number): void => {
      const durationValue = durationRef.current
      const max = Number.isFinite(durationValue) && durationValue > 0 ? durationValue : seekTo
      const clamped = Math.max(0, Math.min(seekTo, max))
      isDraggingSeekRef.current = false
      setIsDraggingSeek(false)
      currentTimeRef.current = clamped
      localSeekTimeRef.current = clamped
      setLocalSeekTime(clamped)
      setCurrentTime(clamped)
      if (videoRef.current) videoRef.current.currentTime = clamped
      sendCommand({ action: 'seek', itemId: item.id, value: clamped })
    },
    [item.id, sendCommand]
  )

  useEffect(() => {
    const handleRelativeSeek = (event: Event): void => {
      const detail = (event as CustomEvent<{ seconds?: number }>).detail
      const offset = detail?.seconds
      if (typeof offset !== 'number' || !Number.isFinite(offset)) return
      const base = videoRef.current?.currentTime ?? currentTimeRef.current
      commitSeek(base + offset)
    }

    window.addEventListener('media:videoSeekRelative', handleRelativeSeek)
    return () => window.removeEventListener('media:videoSeekRelative', handleRelativeSeek)
  }, [commitSeek])

  const releaseSeekPointer = useCallback((target: HTMLInputElement, pointerId: number): void => {
    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId)
    }
  }, [])

  if (error) {
    return (
      <PreviewLoadError
        message={t('presenter.videoLoadFailed')}
        retryLabel={t('presenter.retry')}
        onRetry={() => setRetryToken((value) => value + 1)}
      />
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
            onTimeUpdate={() => {
              const value = videoRef.current?.currentTime ?? 0
              currentTimeRef.current = value
              setCurrentTime(value)
            }}
            onDurationChange={() => {
              const value = videoRef.current?.duration ?? 0
              durationRef.current = value
              setDuration(value)
            }}
            onPlay={() => setPlaybackState({ hasStarted: true, isPlaying: true, isEnded: false })}
            onPause={() => setPlaybackState({ isPlaying: false })}
            onEnded={() => {
              setPlaybackState({ isPlaying: false, isEnded: true })
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
            setPlaybackState({ hasStarted: true, isPlaying: true, isEnded: false })
            videoRef.current
              ?.play()
              .then(() => setPlaybackState({ hasStarted: true, isPlaying: true, isEnded: false }))
              .catch(() => setPlaybackState({ isPlaying: false }))
            sendCommand({ action: 'play', itemId: item.id })
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="rounded-full p-4 presenter-media-control">
            <Play size={70} weight="fill" />
          </div>
        </button>
      )}

      {flashState && (
        <div
          key={flashState.key}
          className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none video-flash-icon"
        >
          <div className="rounded-full p-4 presenter-media-control">
            {flashState.icon === 'play' ? (
              <Play size={70} weight="fill" />
            ) : (
              <Pause size={70} weight="fill" />
            )}
          </div>
        </div>
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
            className="video-seek-range w-full"
            ref={seekInputRef}
            style={
              {
                '--seek-fill': `${(((isDraggingSeek ? localSeekTime : currentTime) / (duration || 1)) * 100).toFixed(2)}%`
              } as React.CSSProperties
            }
            onPointerDown={(e) => {
              const value = Number(e.currentTarget.value)
              isDraggingSeekRef.current = true
              setIsDraggingSeek(true)
              localSeekTimeRef.current = value
              setLocalSeekTime(value)
              e.currentTarget.setPointerCapture(e.pointerId)
            }}
            onInput={(e) => {
              const value = Number(e.currentTarget.value)
              localSeekTimeRef.current = value
              setLocalSeekTime(value)
              if (!isDraggingSeekRef.current) {
                commitSeek(value)
              }
            }}
            onPointerUp={(e) => {
              const seekTo = Number((e.target as HTMLInputElement).value)
              localSeekTimeRef.current = seekTo
              releaseSeekPointer(e.currentTarget, e.pointerId)
              commitSeek(localSeekTimeRef.current)
            }}
            onPointerCancel={(e) => {
              releaseSeekPointer(e.currentTarget, e.pointerId)
              isDraggingSeekRef.current = false
              setIsDraggingSeek(false)
            }}
          />

          <div className="flex items-stretch pl-2 pb-2 gap-2">
            <div className="inline-flex rounded-full presenter-media-control">
              <button
                className="w-11 h-11 inline-flex items-center justify-center text-white/80 hover:text-white rounded-full transition-colors"
                onClick={handlePlayPause}
              >
                {isEnded ? (
                  <ArrowCounterClockwise size={24} weight="fill" />
                ) : isPlaying ? (
                  <Pause size={24} weight="fill" />
                ) : (
                  <Play size={24} weight="fill" />
                )}
              </button>
            </div>

            <div
              className="inline-flex items-center rounded-full presenter-media-control"
              onMouseEnter={() => setIsVolumeHovered(true)}
              onMouseLeave={() => setIsVolumeHovered(false)}
            >
              <button
                className="w-11 h-11 inline-flex items-center justify-center text-white/80 hover:text-white rounded-full transition-colors"
                onClick={handleVolumeIconClick}
              >
                {isMuted || volume === 0 ? (
                  <SpeakerX size={24} weight="fill" />
                ) : volume < 0.4 ? (
                  <SpeakerLow size={24} weight="fill" />
                ) : (
                  <SpeakerHigh size={24} weight="fill" />
                )}
              </button>
              <div
                style={{
                  width: isVolumeHovered ? '100px' : '0',
                  overflow: 'hidden',
                  transition: 'width 0.25s ease, padding-right 0.25s ease',
                  opacity: isVolumeHovered ? 1 : 0,
                  paddingRight: isVolumeHovered ? '8px' : '0'
                }}
              >
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  className="vol-range w-full cursor-pointer pr-3"
                  style={
                    {
                      '--vol-fill': `${((isMuted ? 0 : volume) * 100).toFixed(1)}%`
                    } as React.CSSProperties
                  }
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="inline-flex items-center rounded-full presenter-media-control px-4 py-2.5">
              <span className="text-white/70 text-base tabular-nums whitespace-nowrap">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
