<template>
  <v-dialog v-model="dialogVisible" max-width="840px" content-class="dialog-top">
    <v-card>
      <v-card-title
        class="text-h5 d-flex align-center justify-space-between pb-3 pt-3 sticky-header"
      >
        <!-- 麵包屑顯示 -->
        <div class="d-flex align-center">
          <span class="text-subtitle-1">
            {{ $t('bible.title') }}
          </span>
          <v-icon v-if="selectedBook" size="small" class="mx-1 breadcrumb-icon"
            >mdi-chevron-right</v-icon
          >
          <span v-if="selectedBook" class="text-subtitle-1">
            {{ selectedBook.name }}
          </span>
          <v-icon v-if="selectedChapter" size="small" class="mx-1 breadcrumb-icon"
            >mdi-chevron-right</v-icon
          >
          <span v-if="selectedChapter" class="text-subtitle-1"> {{ selectedChapter }}章 </span>
        </div>

        <!-- 步驟導航按鈕 -->
        <div class="d-flex align-center gap-2">
          <v-btn
            size="small"
            :color="currentStep === 'books' ? 'primary' : 'default'"
            :variant="currentStep === 'books' ? 'flat' : 'outlined'"
            :disabled="false"
            @click="navigateToStep('books')"
          >
            書
          </v-btn>
          <v-btn
            size="small"
            :color="currentStep === 'chapters' ? 'primary' : 'default'"
            :variant="currentStep === 'chapters' ? 'flat' : 'outlined'"
            :disabled="!canNavigateToChapter"
            @click="navigateToStep('chapters')"
          >
            章
          </v-btn>
          <v-btn
            size="small"
            :color="currentStep === 'verses' ? 'primary' : 'default'"
            :variant="currentStep === 'verses' ? 'flat' : 'outlined'"
            :disabled="!canNavigateToVerse"
            @click="navigateToStep('verses')"
          >
            節
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
              <p class="mt-2">載入聖經內容中...</p>
            </div>

            <div v-else-if="!bibleContent" class="text-center py-8">
              <v-icon size="64" class="mb-4">mdi-alert-circle</v-icon>
              <p>無法載入聖經內容</p>
            </div>

            <div v-else>
              <div class="mb-5">
                <v-row>
                  <v-col v-for="book in oldTestamentBooks" :key="book.id" cols="3" class="pa-2">
                    <v-btn
                      block
                      variant="outlined"
                      @click="selectBook(book)"
                      class="text-none text-h6 book-btn"
                    >
                      {{ book.name }}
                    </v-btn>
                  </v-col>
                </v-row>
              </div>
              <div>
                <v-divider class="mb-5" />
                <v-row>
                  <v-col v-for="book in newTestamentBooks" :key="book.id" cols="3" class="pa-2">
                    <v-btn
                      block
                      variant="outlined"
                      @click="selectBook(book)"
                      class="text-none text-h6 book-btn"
                    >
                      {{ book.name }}
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
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBibleCache } from '@/composables/useBibleCache'
import type { BibleContent, BibleBook } from '@/types/bible'
import { useSentry } from '@/composables/useSentry'

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

const { t: $t } = useI18n()
const { getBibleContent } = useBibleCache()
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

// 從API數據計算書卷列表
const oldTestamentBooks = computed(() => {
  if (!bibleContent.value) return []
  return bibleContent.value.books.filter((book) => book.number <= 39)
})

const newTestamentBooks = computed(() => {
  if (!bibleContent.value) return []
  return bibleContent.value.books.filter((book) => book.number > 39)
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

const selectBook = (book: BibleBook) => {
  selectedBook.value = book
  currentStep.value = 'chapters'
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
    // 每次開啟dialog都重置到書卷選擇
    resetToBooks()
  }
})

// 重置到書卷選擇狀態
const resetToBooks = () => {
  currentStep.value = 'books'
  selectedBook.value = null
  selectedChapter.value = null
}

const closeDialog = () => {
  dialogVisible.value = false
  // 重置狀態
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
</style>

<style>
.dialog-top .v-overlay__content {
  margin-top: 64px !important;
  top: 64px !important;
  position: fixed !important;
}
</style>
