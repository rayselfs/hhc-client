<template>
  <v-dialog v-model="dialogVisible" max-width="840px" content-class="dialog-top">
    <v-card :min-height="`calc(100vh - 48px)`">
      <v-card-title
        class="text-h5 d-flex align-center justify-space-between pb-3 pt-3 sticky-header"
      >
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

        <!-- 搜尋框和步驟導航按鈕 -->
        <div class="d-flex align-center gap-2">
          <!-- 搜尋框 - 只在書卷頁面顯示 -->
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

          <!-- 步驟導航按鈕 -->
          <v-btn
            size="small"
            class="text-subtitle-1"
            :color="currentStep === 'books' ? 'primary' : 'default'"
            :variant="currentStep === 'books' ? 'flat' : 'outlined'"
            :disabled="false"
            @click="navigateToStep('books')"
          >
            {{ $t('bible.navigateBook') }}
          </v-btn>
          <v-btn
            size="small"
            class="text-subtitle-1"
            :color="currentStep === 'chapters' ? 'primary' : 'default'"
            :variant="currentStep === 'chapters' ? 'flat' : 'outlined'"
            :disabled="!canNavigateToChapter"
            @click="navigateToStep('chapters')"
          >
            {{ $t('bible.navigateChapter') }}
          </v-btn>
          <v-btn
            size="small"
            class="text-subtitle-1"
            :color="currentStep === 'verses' ? 'primary' : 'default'"
            :variant="currentStep === 'verses' ? 'flat' : 'outlined'"
            :disabled="!canNavigateToVerse"
            @click="navigateToStep('verses')"
          >
            {{ $t('bible.navigateVerse') }}
          </v-btn>
        </div>
      </v-card-title>

      <v-divider />

      <v-card-text class="mt-5 pr-5 pl-5">
        <transition name="page-slide" mode="out-in">
          <!-- 書卷選擇頁面 -->
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
                      variant="outlined"
                      @click="selectBookByNumber(book.number)"
                      class="text-none text-h6 book-btn"
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
                      variant="outlined"
                      @click="selectBookByNumber(book.number)"
                      class="text-none text-h6 book-btn"
                    >
                      {{ getBookName(book.code) }}
                    </v-btn>
                  </v-col>
                </v-row>
              </div>
            </div>
          </div>

          <!-- 章選擇頁面 -->
          <div v-else-if="currentStep === 'chapters'" key="chapters">
            <div class="chapter-verse-grid">
              <v-btn
                v-for="chapterNum in selectedBookChapters"
                :key="chapterNum"
                variant="outlined"
                @click="selectChapter(chapterNum)"
                class="text-none chapter-verse-btn text-h5 ma-1"
              >
                {{ chapterNum }}
              </v-btn>
            </div>
          </div>

          <!-- 節選擇頁面 -->
          <div v-else-if="currentStep === 'verses'" key="verses">
            <div class="chapter-verse-grid">
              <v-btn
                v-for="verseNum in selectedChapterVerses"
                :key="verseNum"
                variant="outlined"
                @click="selectVerse(verseNum)"
                class="text-none chapter-verse-btn text-h5 ma-1"
              >
                {{ verseNum }}
              </v-btn>
            </div>
          </div>
        </transition>
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn color="primary" variant="text" @click="closeDialog">
          {{ $t('close') }}
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
  versionId?: number | null
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'select-book', book: BibleBook): void
  (e: 'select-chapter', book: BibleBook, chapter: number): void
  (e: 'select-verse', book: BibleBook, chapter: number, verse: number): void
}

// 使用 Bible Store 的 Cache 功能
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

// 當前步驟：'books' | 'chapters' | 'verses'
const currentStep = ref<'books' | 'chapters' | 'verses'>('books')
const selectedBook = ref<BibleBook | null>(null)
const selectedChapter = ref<number | null>(null)

// 搜尋功能
const searchQuery = ref('')

// 聖經內容數據
const bibleContent = ref<BibleContent | null>(null)
const loading = ref(false)

// 導航控制
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

// 獲取選中書卷的章節數（從API數據獲取）
const selectedBookChapters = computed(() => {
  if (!selectedBook.value) return []
  return Array.from({ length: selectedBook.value.chapters.length }, (_, i) => i + 1)
})

// 獲取選中章節的節數（從API數據獲取）
const selectedChapterVerses = computed(() => {
  if (!selectedBook.value || !selectedChapter.value) return []

  const chapter = selectedBook.value.chapters.find((ch) => ch.number === selectedChapter.value)
  if (!chapter) return []

  return chapter.verses.map((verse) => verse.number)
})

// 導航到指定步驟
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

  emit('select-verse', selectedBook.value, selectedChapter.value, verse)
  closeDialog()
}

// 載入聖經內容
const loadBibleContent = async () => {
  if (!props.versionId) return

  loading.value = true
  try {
    const content = await getBibleContent(props.versionId)
    bibleContent.value = content
  } catch (error) {
    reportError(error, {
      operation: 'load-bible-content-dialog',
      component: 'BibleBooksDialog',
      extra: { versionId: props.versionId },
    })
  } finally {
    loading.value = false
  }
}

// 監聽版本變化
watch(
  () => props.versionId,
  () => {
    if (props.versionId && dialogVisible.value) {
      loadBibleContent()
    }
  },
)

// 監聽dialog開啟
watch(dialogVisible, (visible) => {
  if (visible && props.versionId) {
    loadBibleContent()
    resetToBooks()
  }
})

// 重置到書卷選擇狀態
const resetToBooks = () => {
  currentStep.value = 'books'
  selectedBook.value = null
  selectedChapter.value = null
  searchQuery.value = '' // 清除搜尋框
}

const closeDialog = () => {
  dialogVisible.value = false
  resetToBooks()
}
</script>

<style scoped>
.v-dialog > .v-overlay__content > .v-card > .v-card-text {
  padding: 0px;
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

.gap-2 {
  gap: 8px;
}

.book-btn {
  height: 48px;
}

.chapter-verse-grid {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 8px;
}

.chapter-verse-btn {
  min-width: 48px;
  height: 48px;
}

.sticky-header {
  position: sticky;
  top: 0;
  background-color: rgb(var(--v-theme-surface));
  z-index: 10;
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.12);
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
.dialog-top .v-overlay__content {
  margin-top: 64px !important;
  top: 64px !important;
  position: fixed !important;
}
</style>

