import React, { useCallback, useEffect, useRef, useState } from 'react'

interface OsFileDropCallbacks {
  onDrop: (dataTransfer: DataTransfer, targetFolderId: string | null) => Promise<void> | void
}

interface UseOsFileDropResult {
  isOsDragOver: boolean
  osDragTargetFolderId: string | null
  handlers: {
    onDragEnter: (e: React.DragEvent) => void
    onDragOver: (e: React.DragEvent) => void
    onDragLeave: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent) => void
  }
}

export function useOsFileDrop(
  containerRef: React.RefObject<HTMLElement | null>,
  callbacks: OsFileDropCallbacks
): UseOsFileDropResult {
  const [isOsDragOver, setIsOsDragOver] = useState(false)
  const [osDragTargetFolderId, setOsDragTargetFolderId] = useState<string | null>(null)
  const osDragTargetFolderIdRef = useRef<string | null>(null)
  const callbacksRef = useRef(callbacks)

  useEffect(() => {
    callbacksRef.current = callbacks
  })

  const onDragEnter = useCallback((e: React.DragEvent): void => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    setIsOsDragOver(true)
  }, [])

  const onDragOver = useCallback((e: React.DragEvent): void => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const folderEl = (e.target as Element).closest<HTMLElement>('[data-folder-id]')
    const folderId = folderEl?.dataset.folderId ?? null
    if (folderId !== osDragTargetFolderIdRef.current) {
      osDragTargetFolderIdRef.current = folderId
      setOsDragTargetFolderId(folderId)
    }
  }, [])

  const onDragLeave = useCallback(
    (e: React.DragEvent): void => {
      if (!e.dataTransfer.types.includes('Files')) return
      const container = containerRef.current
      if (container && e.relatedTarget && container.contains(e.relatedTarget as Node)) return
      setIsOsDragOver(false)
      osDragTargetFolderIdRef.current = null
      setOsDragTargetFolderId(null)
    },
    [containerRef]
  )

  const onDrop = useCallback((e: React.DragEvent): void => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    setIsOsDragOver(false)
    const targetId = osDragTargetFolderIdRef.current
    osDragTargetFolderIdRef.current = null
    setOsDragTargetFolderId(null)
    void callbacksRef.current.onDrop(e.dataTransfer, targetId)
  }, [])

  return {
    isOsDragOver,
    osDragTargetFolderId,
    handlers: { onDragEnter, onDragOver, onDragLeave, onDrop }
  }
}
