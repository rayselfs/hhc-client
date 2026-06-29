import { create } from 'zustand'
import { isEditablePresentationMimeType } from '@renderer/lib/presentation-media'
import type { FileItemRecord } from '@shared/types/folder'

export interface PresentationWorkspaceDocument {
  itemId: string
  mode: 'pptx' | 'editable'
  name: string
  mimeType: string
  url: string
  size: number
  openedAt: number
  slideCount?: number
}

interface PresentationWorkspaceState {
  documents: PresentationWorkspaceDocument[]
  activeItemId: string | null
  activeSlideByItemId: Record<string, number>

  openDocument: (item: FileItemRecord) => void
  closeDocument: (itemId: string) => void
  setActiveDocument: (itemId: string) => void
  updateDocumentName: (itemId: string, name: string) => void
  setActiveSlide: (itemId: string, slideIndex: number) => void
  setSlideCount: (itemId: string, slideCount: number) => void
  getActiveDocument: () => PresentationWorkspaceDocument | null
  getActiveSlide: (itemId: string) => number
}

function toWorkspaceDocument(item: FileItemRecord): PresentationWorkspaceDocument {
  return {
    itemId: item.id,
    mode: isEditablePresentationMimeType(item.mimeType) ? 'editable' : 'pptx',
    name: item.name,
    mimeType: item.mimeType,
    url: item.url,
    size: item.size,
    openedAt: Date.now()
  }
}

export const usePresentationWorkspaceStore = create<PresentationWorkspaceState>()((set, get) => ({
  documents: [],
  activeItemId: null,
  activeSlideByItemId: {},

  openDocument: (item) =>
    set((state) => {
      const existing = state.documents.find((document) => document.itemId === item.id)
      const documents = existing
        ? state.documents.map((document) =>
            document.itemId === item.id ? { ...document, ...toWorkspaceDocument(item) } : document
          )
        : [...state.documents, toWorkspaceDocument(item)]
      return {
        documents,
        activeItemId: item.id,
        activeSlideByItemId: {
          ...state.activeSlideByItemId,
          [item.id]: state.activeSlideByItemId[item.id] ?? 0
        }
      }
    }),

  closeDocument: (itemId) =>
    set((state) => {
      const index = state.documents.findIndex((document) => document.itemId === itemId)
      const documents = state.documents.filter((document) => document.itemId !== itemId)
      const { [itemId]: _removed, ...activeSlideByItemId } = state.activeSlideByItemId
      const activeItemId =
        state.activeItemId !== itemId
          ? state.activeItemId
          : ((documents[Math.max(0, index - 1)] ?? documents[index] ?? null)?.itemId ?? null)
      return { documents, activeItemId, activeSlideByItemId }
    }),

  setActiveDocument: (itemId) => set({ activeItemId: itemId }),

  updateDocumentName: (itemId, name) =>
    set((state) => ({
      documents: state.documents.map((document) =>
        document.itemId === itemId ? { ...document, name } : document
      )
    })),

  setActiveSlide: (itemId, slideIndex) =>
    set((state) => ({
      activeSlideByItemId: {
        ...state.activeSlideByItemId,
        [itemId]: Math.max(0, slideIndex)
      }
    })),

  setSlideCount: (itemId, slideCount) =>
    set((state) => ({
      documents: state.documents.map((document) => {
        if (document.itemId !== itemId || document.slideCount === slideCount) return document
        return { ...document, slideCount }
      }),
      activeSlideByItemId: {
        ...state.activeSlideByItemId,
        [itemId]: Math.min(state.activeSlideByItemId[itemId] ?? 0, Math.max(0, slideCount - 1))
      }
    })),

  getActiveDocument: () => {
    const state = get()
    return state.documents.find((document) => document.itemId === state.activeItemId) ?? null
  },

  getActiveSlide: (itemId) => get().activeSlideByItemId[itemId] ?? 0
}))
