import React, { useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { FolderRecord } from '@shared/types/folder'

export type DndItemData =
  | { type: 'folder'; item: FolderRecord }
  | { type: 'item'; item: unknown }
  | { type: 'folder-dropzone'; folderId: string }

export interface SortableFolderItemProps {
  id: string
  folder: FolderRecord
  isSelected: boolean
  isFolderDropTarget: boolean
  isCut: boolean
  isDraggedAway: boolean
  isMultiDrag: boolean
  children: (isDragging: boolean) => React.ReactNode
}

export function SortableFolderItem({
  id,
  folder,
  isCut,
  isDraggedAway,
  isMultiDrag,
  children
}: SortableFolderItemProps): React.JSX.Element {
  const sortable = useSortable({ id, data: { type: 'folder', item: folder } as DndItemData })
  const droppable = useDroppable({
    id: `drop-${id}`,
    data: { type: 'folder-dropzone', folderId: id } as DndItemData,
    disabled: isDraggedAway
  })

  const setRef = useCallback(
    (el: HTMLElement | null) => {
      sortable.setNodeRef(el)
      droppable.setNodeRef(el)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortable.setNodeRef, droppable.setNodeRef]
  )

  const style: React.CSSProperties = {
    transform: isMultiDrag ? undefined : CSS.Transform.toString(sortable.transform),
    transition: isMultiDrag ? undefined : sortable.transition,
    opacity: sortable.isDragging ? 0.4 : isDraggedAway ? 0.4 : isCut ? 0.4 : 1
  }

  return (
    <li
      ref={setRef}
      style={style}
      className="list-none touch-none"
      {...sortable.attributes}
      {...sortable.listeners}
    >
      {children(sortable.isDragging)}
    </li>
  )
}
