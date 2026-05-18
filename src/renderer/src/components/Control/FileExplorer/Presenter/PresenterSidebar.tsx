import { useEffect, useState } from 'react'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { useThumbnails } from '@renderer/hooks/useThumbnails'

export default function PresenterSidebar() {
  const nextItem = useMediaProjectionStore((s) => s.nextItem())
  const currentItem = useMediaProjectionStore((s) => s.currentItem())
  const updateNotes = useMediaProjectionStore((s) => s.updateNotes)

  const thumbnailItems = nextItem ? [nextItem] : []
  const thumbnails = useThumbnails(thumbnailItems)
  const nextThumbnail = nextItem ? thumbnails[nextItem.id] : undefined

  const [notes, setNotes] = useState(currentItem?.notes ?? '')

  useEffect(() => {
    setNotes(currentItem?.notes ?? '')
  }, [currentItem?.id])

  const handleNotesChange = (value: string) => {
    setNotes(value)
    if (currentItem) {
      updateNotes(currentItem.id, value)
    }
  }

  return (
    <div className="flex flex-col h-full bg-black/50 border-l border-white/10">
      <div className="p-3 border-b border-white/10">
        <div className="text-white/50 text-xs uppercase tracking-wide mb-2">Next</div>
        <div className="aspect-video bg-black/50 rounded overflow-hidden flex items-center justify-center">
          {nextItem === null && (
            <span className="text-white/50 text-sm">投影結束</span>
          )}
          {nextItem && nextThumbnail && (
            <img
              src={nextThumbnail}
              alt={nextItem.name}
              className="w-full h-full object-contain"
            />
          )}
          {nextItem && !nextThumbnail && (
            <span className="text-white/30 text-xs">No preview</span>
          )}
        </div>
        {nextItem && (
          <div className="text-white/70 text-xs mt-1 truncate">{nextItem.name}</div>
        )}
      </div>

      <div className="flex-1 flex flex-col p-3">
        <div className="text-white/50 text-xs uppercase tracking-wide mb-2">Notes</div>
        <textarea
          className="flex-1 bg-black/30 text-white/90 text-sm rounded p-2 resize-none border border-white/10 focus:outline-none focus:border-white/30"
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Add notes..."
        />
      </div>
    </div>
  )
}
