import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { AnyItemRecord } from '@shared/types/folder'
import type { DndItemData } from './SortableFolderItem'

export interface SortableItemProps {
  id: string
  item: AnyItemRecord
  isSelected: boolean
  isCut: boolean
  isDraggedAway: boolean
  isMultiDrag: boolean
  children: (isDragging: boolean) => React.ReactNode
}

export function SortableItem({
  id,
  item,
  isCut,
  isDraggedAway,
  isMultiDrag,
  children
}: SortableItemProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: 'item', item } as DndItemData
  })

  const style: React.CSSProperties = {
    transform: isMultiDrag ? undefined : CSS.Transform.toString(transform),
    transition: isMultiDrag ? undefined : transition,
    opacity: isDragging ? 0.4 : isDraggedAway ? 0.4 : isCut ? 0.4 : 1
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="list-none touch-none"
      {...attributes}
      {...listeners}
    >
      {children(isDragging)}
    </li>
  )
}
