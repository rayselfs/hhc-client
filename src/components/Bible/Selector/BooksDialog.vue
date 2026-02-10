<template>
  <v-dialog v-model="dialogVisible" max-width="840px" content-class="dialog-top">
    <v-card rounded="lg" class="dialog-card">
      <v-card-title class="text-h5 d-flex align-center justify-space-between pb-3 pt-3">
        <!-- breadcrumb -->
        <div class="d-flex align-center">
          <span class="text-subtitle-1">
            {{ $t('bible.title') }}
          </span>
          <v-icon v-if="selectedBook" size="small" class="mx-1 breadcrumb-icon"
            >mdi-chevron-right</v-icon
          >
          <span v-if="selectedBook" class="text-subtitle-1">
            {{ getBookNameByNumber(selectedBook.number) }}
          </span>
          <v-icon v-if="selectedChapter" size="small" class="mx-1 breadcrumb-icon"
            >mdi-chevron-right</v-icon
          >
          <span v-if="selectedChapter" class="text-subtitle-1"> {{ selectedChapter }}</span>
        </div>

        <!-- Search box and step navigation buttons -->
        <div class="d-flex align-center ga-2">
          <!-- Search box - only shown on books page -->
          <v-text-field
            v-if="currentStep === 'books'"
            v-model="searchQuery"
            :placeholder="$t('bible.searchBooks')"
            variant="plain"
            density="compact"
            hide-details
            clearable
            prepend-inner-icon="mdi-magnify"
            class="search-field"
            max-width="200"
            min-width="150"
          />

          <!-- Step navigation buttons -->
          <v-btn
            size="small"
            class="text-subtitle-1"
            :color="currentStep === 'books' ? 'primary' : 'default'"
            :variant="currentStep === 'books' ? 'flat' : 'elevated'"
            :disabled="false"
            rounded="xl"
            @click="navigateToStep('books')"
          >
            {{ $t('bible.navigateBook') }}
          </v-btn>
          <v-btn
            size="small"
            class="text-subtitle-1"
            :color="currentStep === 'chapters' ? 'primary' : 'default'"
            :variant="currentStep === 'chapters' ? 'flat' : 'elevated'"
            :disabled="!canNavigateToChapter"
            rounded="xl"
            @click="navigateToStep('chapters')"
          >
            {{ $t('bible.navigateChapter') }}
          </v-btn>
          <v-btn
            size="small"
            class="text-subtitle-1"
            :color="currentStep === 'verses' ? 'primary' : 'default'"
            :variant="currentStep === 'verses' ? 'flat' : 'elevated'"
            :disabled="!canNavigateToVerse"
            rounded="xl"
            @click="navigateToStep('verses')"
          >
            {{ $t('bible.navigateVerse') }}
          </v-btn>
        </div>
      </v-card-title>

      <v-divider />

      <v-card-text class="card-content pr-5 pl-5">
        <transition name="page-slide" mode="out-in">
          <!-- Book selection page -->
          <div v-if="currentStep === 'books'" key="books">
            <div v-if="loading" class="text-center py-8">
              <v-progress-circular indeterminate color="primary" />
              <p class="mt-2">{{ $t('bible.loadingContent') }}</p>
            </div>

            <div v-else-if="!bibleContent" class="text-center py-8">
              <v-icon size="64" class="mb-4">mdi-alert-circle</v-icon>
              <p>{{ $t('bible.loadContentFailed') }}</p>
            </div>

            <div v-else>
              <div class="mb-5">
                <v-row>
                  <v-col v-for="book in oldTestamentBooks" :key="book.number" cols="3" class="pa-2">
                    <v-btn
                      block
                      variant="tonal"
                      @click="selectBookByNumber(book.number)"
                      class="text-none text-h6"
                      rounded="xl"
                    >
                      {{ getBookName(book.code) }}
                    </v-btn>
                  </v-col>
                </v-row>
              </div>
              <div>
                <v-divider class="mb-5" />
                <v-row>
                  <v-col v-for="book in newTestamentBooks" :key="book.number" cols="3" class="pa-2">
                    <v-btn
                      block
                      variant="tonal"
                      @click="selectBookByNumber(book.number)"
                      class="text-none text-h6"
                      rounded="xl"
                    >
                      {{ getBookName(book.code) }}
                    </v-btn>
                  </v-col>
                </v-row>
              </div>
            </div>
          </div>

          <!-- Chapter selection page -->
          <div v-else-if="currentStep === 'chapters'" key="chapters">
            <div class="chapter-verse-grid ga-2">
              <v-btn
                v-for="chapterNum in selectedBookChapters"
                :key="chapterNum"
                variant="tonal"
                @click="selectChapter(chapterNum)"
                class="text-none text-h5 ma-1"
                rounded="xl"
              >
                {{ chapterNum }}
              </v-btn>
            </div>
          </div>

          <!-- Verse selection page -->
          <div v-else-if="currentStep === 'verses'" key="verses">
            <div class="chapter-verse-grid ga-2">
              <v-btn
                v-for="verseNum in selectedChapterVerses"
                :key="verseNum"
                variant="tonal"
                @click="selectVerse(verseNum)"
                class="text-none text-h5 ma-1"
                rounded="xl"
              >
                {{ verseNum }}
              </v-btn>
            </div>
          </div>
        </transition>
      </v-card-text>

      <v-card-actions class="pa-2">
        <v-spacer />
        <v-btn variant="elevated" rounded="xl" @click="closeDialog">
          {{ $t('common.close') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
defineOptions({
  name: 'BibleBooksDialog',
})

import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BibleContent, BibleBook } from '@/types/bible'
import { useSentry } from '@/composables/useSentry'
import { useBibleStore } from '@/stores/bible'
import { BIBLE_BOOKS, type BibleBookConfig } from '@/config/app'

interface Props {
  modelValue: boolean
  versionCode?: string | null
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'select-book', book: BibleBook): void
  (e: 'select-chapter', book: BibleBook, chapter: number): void
  (e: 'select-verse', bookNumber: number, chapter: number, verse: number): void
}

// Use Bible Store's cache functionality
const bibleStore = useBibleStore()
const { getBibleContent } = bibleStore

const { t: $t } = useI18n()
const { reportError } = useSentry()
const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Current step: 'books' | 'chapters' | 'verses'
const currentStep = ref<'books' | 'chapters' | 'verses'>('books')
const selectedBook = ref<BibleBook | null>(null)
const selectedChapter = ref<number | null>(null)

// Search functionality
const searchQuery = ref('')

// Bible content data
const bibleContent = ref<BibleContent | null>(null)
const loading = ref(false)

// Navigation control
const canNavigateToChapter = computed(() => {
  return selectedBook.value !== null
})

const canNavigateToVerse = computed(() => {
  return selectedBook.value !== null && selectedChapter.value !== null
})

// Get book name from i18n using book code
const getBookName = (bookCode: string): string => {
  return $t(`bible.books.${bookCode}`) as string
}

// Filter books by search query
const filterBooks = (books: BibleBookConfig[]) => {
  if (!searchQuery.value || !searchQuery.value.trim()) return books
  const query = searchQuery.value.toLowerCase().trim()
  return books.filter((book) => {
    const bookName = getBookName(book.code).toLowerCase()
    return bookName.includes(query)
  })
}

// Get all filtered books
const filteredBooks = computed(() => {
  return filterBooks(BIBLE_BOOKS)
})

// Separate Old and New Testament books
const oldTestamentBooks = computed(() => {
  return filteredBooks.value.filter((book) => book.number <= 39)
})

const newTestamentBooks = computed(() => {
  return filteredBooks.value.filter((book) => book.number > 39)
})

// Get chapter numbers for the selected book (from API data)
const selectedBookChapters = computed(() => {
  if (!selectedBook.value) return []
  return Array.from({ length: selectedBook.value.chapters.length }, (_, i) => i + 1)
})

// Get verse numbers for the selected chapter (from API data)
const selectedChapterVerses = computed(() => {
  if (!selectedBook.value || !selectedChapter.value) return []

  const chapter = selectedBook.value.chapters.find((ch) => ch.number === selectedChapter.value)
  if (!chapter) return []

  return chapter.verses.map((verse) => verse.number)
})

// Navigate to specified step
const navigateToStep = (step: 'books' | 'chapters' | 'verses') => {
  if (step === 'books') {
    currentStep.value = 'books'
  } else if (step === 'chapters' && canNavigateToChapter.value) {
    currentStep.value = 'chapters'
  } else if (step === 'verses' && canNavigateToVerse.value) {
    currentStep.value = 'verses'
  }
}

// Get book code by number
const getBookCodeByNumber = (bookNumber: number): string | null => {
  const book = BIBLE_BOOKS.find((b) => b.number === bookNumber)
  return book?.code ?? null
}

// Get book name by number
const getBookNameByNumber = (bookNumber: number): string => {
  const code = getBookCodeByNumber(bookNumber)
  if (!code) return ''
  return getBookName(code)
}

// Select book by number (find from bibleContent)
const selectBookByNumber = (bookNumber: number) => {
  if (!bibleContent.value) return
  const book = bibleContent.value.books.find((b) => b.number === bookNumber)
  if (book) {
    selectedBook.value = book
    currentStep.value = 'chapters'
    searchQuery.value = ''
  }
}

const selectChapter = (chapter: number) => {
  if (!selectedBook.value) return

  selectedChapter.value = chapter
  currentStep.value = 'verses'
}

const selectVerse = (verse: number) => {
  if (!selectedBook.value || !selectedChapter.value) return
  closeDialog()
  emit('select-verse', selectedBook.value.number, selectedChapter.value, verse)
  resetToBooks()
}

// Load Bible content
const loadBibleContent = async () => {
  if (!props.versionCode) return

  loading.value = true
  try {
    bibleContent.value = await getBibleContent(props.versionCode)
  } catch (error) {
    reportError(error, {
      operation: 'load-bible-content-dialog',
      component: 'BibleBooksDialog',
      extra: { versionCode: props.versionCode },
    })
  } finally {
    loading.value = false
  }
}

// Watch for version changes
watch(
  () => props.versionCode,
  () => {
    if (props.versionCode && dialogVisible.value) {
      loadBibleContent()
    }
  },
)

// Watch for dialog open
watch(dialogVisible, (visible) => {
  if (visible && props.versionCode) {
    loadBibleContent()
    resetToBooks()
  }
})

// Reset to book selection state
const resetToBooks = () => {
  currentStep.value = 'books'
  searchQuery.value = '' // Clear search box
}

const closeDialog = () => {
  dialogVisible.value = false
}
</script>

<style scoped>
.dialog-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.card-content {
  flex: 1 1 0;
  min-height: calc(100vh - 40px - 44px - 24px - 24px - 24px - 18px);
  overflow-y: auto;
  overflow-x: hidden;
}

.breadcrumb-icon {
  /* height: 28px; */
  font-size: 0.8rem;
}

.page-slide-enter-active,
.page-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.page-slide-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.page-slide-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.page-slide-enter-to,
.page-slide-leave-from {
  opacity: 1;
  transform: translateX(0);
}

.book-btn {
  height: 48px;
}

.chapter-verse-grid {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
}

.search-field {
  transition: all 0.3s ease;
  height: 28px;
}

.search-field :deep(.v-field__input) {
  font-size: 0.875rem;
}
</style>

<style>
/* Global: Vuetify overlay positioning requires unscoped override for .v-overlay__content class */
.dialog-top .v-overlay__content {
  /* Override: Vuetify overlay positioning for dialog top offset */
  margin-top: 64px !important;
  /* Override: Vuetify overlay positioning for dialog top offset */
  top: 64px !important;
  /* Override: Vuetify overlay positioning for dialog top offset */
  position: fixed !important;
}
</style>
