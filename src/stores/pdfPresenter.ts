import { defineStore } from 'pinia'
import { ref, computed, shallowRef, markRaw } from 'vue'
import type { PdfViewMode } from '@/composables/usePdf'
import type { PdfService } from '@/services/pdf/PdfService'

export const usePdfPresenterStore = defineStore('pdf-presenter', () => {
  const showSidebar = ref(false)
  // Use shallowRef to avoid Vue's Proxy wrapping, which breaks PDF.js private class fields
  const pdfServiceRef = shallowRef<PdfService | null>(null)
  const currentPage = ref(1)
  const pageCount = ref(0)
  const viewMode = ref<PdfViewMode>('slide')

  const hasPdf = computed(() => pageCount.value > 0)
  const canGoPrev = computed(() => currentPage.value > 1)
  const canGoNext = computed(() => currentPage.value < pageCount.value)

  const toggleSidebar = () => {
    showSidebar.value = !showSidebar.value
  }

  const openSidebar = () => {
    showSidebar.value = true
  }

  const closeSidebar = () => {
    showSidebar.value = false
  }

  const setPage = (page: number) => {
    currentPage.value = Math.max(1, Math.min(page, pageCount.value || Infinity))
  }

  const nextPage = () => {
    if (canGoNext.value) {
      currentPage.value++
    }
  }

  const prevPage = () => {
    if (canGoPrev.value) {
      currentPage.value--
    }
  }

  const setPageCount = (count: number) => {
    pageCount.value = Math.max(0, count)
  }

  const setViewMode = (mode: PdfViewMode) => {
    viewMode.value = mode
  }

  const setPdfService = (service: PdfService | null) => {
    pdfServiceRef.value = service ? markRaw(service) : null
  }

  const reset = () => {
    showSidebar.value = false
    currentPage.value = 1
    pageCount.value = 0
    viewMode.value = 'slide'
    pdfServiceRef.value = null
  }

  return {
    showSidebar,
    currentPage,
    pageCount,
    viewMode,
    pdfService: pdfServiceRef,
    hasPdf,
    canGoPrev,
    canGoNext,
    toggleSidebar,
    openSidebar,
    closeSidebar,
    setPage,
    nextPage,
    prevPage,
    setPageCount,
    setViewMode,
    setPdfService,
    reset,
  }
})
