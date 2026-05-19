import React from 'react'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { useThumbnails } from '@renderer/hooks/useThumbnails'

export default function PresenterGrid(): React.JSX.Element {
  const playlist = useMediaProjectionStore((s) => s.playlist)
  const currentIndex = useMediaProjectionStore((s) => s.currentIndex)
  const jumpTo = useMediaProjectionStore((s) => s.jumpTo)
  const toggleGrid = useMediaProjectionStore((s) => s.toggleGrid)
  const thumbnails = useThumbnails(playlist)

  return (
    <div
      className="fixed inset-0 bg-black z-[10000] overflow-y-auto p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) toggleGrid()
      }}
    >
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}
      >
        {playlist.map((item, index) => (
          <button
            key={item.id}
            className={`relative aspect-video rounded overflow-hidden border-2 transition-colors ${
              index === currentIndex ? 'border-white' : 'border-transparent hover:border-white/50'
            }`}
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
              <div className="w-full h-full bg-white/10 flex items-center justify-center text-white/50 text-xs">
                {item.name}
              </div>
            )}
            {index === currentIndex && (
              <div className="absolute inset-0 bg-white/10 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-white" />
              </div>
            )}
            <div className="absolute bottom-1 right-1 text-white/70 text-xs bg-black/50 px-1 rounded">
              {index + 1}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
