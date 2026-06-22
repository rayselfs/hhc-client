import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createPersistName, hhcPersistStorage } from '@renderer/lib/persist-storage'
import {
  createBlankSlide,
  createSlideDocument,
  createTextElement,
  removeSlideElement,
  updateSlideInDocument,
  upsertSlideElement
} from '@renderer/lib/slide-document'
import type { SlideDocument, SlideRecord, SlideTextElement } from '@shared/types/slides'

interface SlidesStoreState {
  documents: Record<string, SlideDocument>
  currentDocumentId: string | null
  selectedSlideId: string | null

  currentDocument: () => SlideDocument | null
  selectedSlide: () => SlideRecord | null
  selectedSlideIndex: () => number

  createDocument: (title?: string) => string
  selectDocument: (documentId: string) => void
  updateDocumentTitle: (documentId: string, title: string) => void
  addSlide: (documentId: string) => string | null
  selectSlide: (slideId: string) => void
  updateSlideTitle: (documentId: string, slideId: string, title: string) => void
  updateSlideBackgroundColor: (documentId: string, slideId: string, color: string) => void
  addTextElement: (documentId: string, slideId: string, text?: string) => string | null
  updateTextElement: (
    documentId: string,
    slideId: string,
    elementId: string,
    patch: { text?: string; style?: Partial<SlideTextElement['style']> }
  ) => void
  removeElement: (documentId: string, slideId: string, elementId: string) => void
  clear: () => void
}

const initialState = {
  documents: {} as Record<string, SlideDocument>,
  currentDocumentId: null as string | null,
  selectedSlideId: null as string | null
}

function updateDocument(
  state: SlidesStoreState,
  documentId: string,
  updater: (document: SlideDocument) => SlideDocument
): Partial<SlidesStoreState> {
  const document = state.documents[documentId]
  if (!document) return {}
  const updated = updater(document)
  return {
    documents: {
      ...state.documents,
      [documentId]: updated
    }
  }
}

export const useSlidesStore = create<SlidesStoreState>()(
  persist(
    (set, get) => ({
      ...initialState,

      currentDocument: () => {
        const { currentDocumentId, documents } = get()
        return currentDocumentId ? (documents[currentDocumentId] ?? null) : null
      },

      selectedSlide: () => {
        const document = get().currentDocument()
        if (!document) return null
        return document.slides.find((slide) => slide.id === get().selectedSlideId) ?? null
      },

      selectedSlideIndex: () => {
        const document = get().currentDocument()
        if (!document) return -1
        return document.slides.findIndex((slide) => slide.id === get().selectedSlideId)
      },

      createDocument: (title = 'Untitled Slide Deck') => {
        const document = createSlideDocument({ title })
        const firstSlideId = document.slides[0]?.id ?? null
        set((state) => ({
          documents: { ...state.documents, [document.id]: document },
          currentDocumentId: document.id,
          selectedSlideId: firstSlideId
        }))
        return document.id
      },

      selectDocument: (documentId) => {
        const document = get().documents[documentId]
        if (!document) return
        set({
          currentDocumentId: document.id,
          selectedSlideId: document.slides[0]?.id ?? null
        })
      },

      updateDocumentTitle: (documentId, title) => {
        set((state) =>
          updateDocument(state, documentId, (document) => ({
            ...document,
            title,
            updatedAt: Date.now()
          }))
        )
      },

      addSlide: (documentId) => {
        const document = get().documents[documentId]
        if (!document) return null
        const slide = createBlankSlide({ title: `Slide ${document.slides.length + 1}` })
        set((state) =>
          updateDocument(state, documentId, (current) => ({
            ...current,
            slides: [...current.slides, slide],
            updatedAt: Date.now()
          }))
        )
        set({ selectedSlideId: slide.id })
        return slide.id
      },

      selectSlide: (slideId) => {
        const document = get().currentDocument()
        if (!document?.slides.some((slide) => slide.id === slideId)) return
        set({ selectedSlideId: slideId })
      },

      updateSlideTitle: (documentId, slideId, title) => {
        set((state) =>
          updateDocument(state, documentId, (document) =>
            updateSlideInDocument(document, slideId, (slide) => ({ ...slide, title }))
          )
        )
      },

      updateSlideBackgroundColor: (documentId, slideId, color) => {
        set((state) =>
          updateDocument(state, documentId, (document) =>
            updateSlideInDocument(document, slideId, (slide) => ({
              ...slide,
              background: { type: 'color', color }
            }))
          )
        )
      },

      addTextElement: (documentId, slideId, text = 'New text') => {
        const element = createTextElement({ text })
        set((state) =>
          updateDocument(state, documentId, (document) =>
            updateSlideInDocument(document, slideId, (slide) => upsertSlideElement(slide, element))
          )
        )
        return element.id
      },

      updateTextElement: (documentId, slideId, elementId, patch) => {
        set((state) =>
          updateDocument(state, documentId, (document) =>
            updateSlideInDocument(document, slideId, (slide) => {
              const element = slide.elements.find((item) => item.id === elementId)
              if (!element || element.type !== 'text') return slide
              return upsertSlideElement(slide, {
                ...element,
                ...patch,
                style: { ...element.style, ...patch.style }
              })
            })
          )
        )
      },

      removeElement: (documentId, slideId, elementId) => {
        set((state) =>
          updateDocument(state, documentId, (document) =>
            updateSlideInDocument(document, slideId, (slide) =>
              removeSlideElement(slide, elementId)
            )
          )
        )
      },

      clear: () => set(initialState)
    }),
    {
      name: createPersistName('slides'),
      storage: hhcPersistStorage,
      version: 0,
      partialize: (state) => ({
        documents: state.documents,
        currentDocumentId: state.currentDocumentId,
        selectedSlideId: state.selectedSlideId
      })
    }
  )
)
