import React, { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { useThumbnails } from '@renderer/hooks/useThumbnails'
import GlassDivider from '@renderer/components/Common/GlassDivider'

export default function PresenterGrid(): React.JSX.Element {
  const { t } = useTranslation()
  const playlist = useMediaProjectionStore((s) => s.playlist)
  const currentIndex = useMediaProjectionStore((s) => s.currentIndex)
  const jumpTo = useMediaProjectionStore((s) => s.jumpTo)
  const toggleGrid = useMediaProjectionStore((s) => s.toggleGrid)
  const thumbnails = useThumbnails(playlist)

  const [focusedIndex, setFocusedIndex] = useState(currentIndex)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  useEffect(() => {
    buttonRefs.current[focusedIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [focusedIndex])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    const cols = window.innerWidth >= 1280 ? 8 : window.innerWidth >= 1024 ? 6 : 4
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault()
        setFocusedIndex((i) => Math.min(i + 1, playlist.length - 1))
        break
      case 'ArrowLeft':
        e.preventDefault()
        setFocusedIndex((i) => Math.max(i - 1, 0))
        break
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex((i) => Math.min(i + cols, playlist.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex((i) => Math.max(i - cols, 0))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        jumpTo(focusedIndex)
        toggleGrid()
        break
      case 'Escape':
        e.preventDefault()
        toggleGrid()
        break
    }
  }

  return (
    <div className="fixed inset-0 bg-background z-[10000] flex flex-col overflow-hidden">
      <div className="shrink-0 flex items-center px-4 py-2 bg-background">
        <Button
          isIconOnly
          variant="ghost"
          size="sm"
          onPress={toggleGrid}
          aria-label={t('common.close')}
        >
          <X size={18} />
        </Button>
      </div>

      <GlassDivider />

      <div
        ref={containerRef}
        tabIndex={0}
        className="flex-1 overflow-y-auto p-6 outline-none"
        onKeyDown={handleKeyDown}
      >
        <div className="grid gap-3 grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {playlist.map((item, index) => (
            <button
              key={item.id}
              ref={(el) => {
                buttonRefs.current[index] = el
              }}
              className={`relative aspect-video rounded overflow-hidden border-3 transition-colors ${
                index === currentIndex
                  ? 'border-accent'
                  : index === focusedIndex
                    ? 'border-accent/80'
                    : 'border-transparent hover:border-accent'
              }`}
              onMouseEnter={() => setFocusedIndex(index)}
              onClick={() => {
                jumpTo(index)
                toggleGrid()
              }}
            >
              {thumbnails[item.id] ? (
                <img
                  src={thumbnails[item.id]!}
                  className="w-full h-full object-cover"
                  alt={item.name}
                />
              ) : (
                <div className="w-full h-full bg-default-200 flex items-center justify-center text-foreground/50 text-xs">
                  {item.name}
                </div>
              )}
              {index === currentIndex && (
                <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                </div>
              )}
              <div className="absolute bottom-1 right-1 text-foreground/70 text-xs bg-background/70 px-1 rounded">
                {index + 1}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
