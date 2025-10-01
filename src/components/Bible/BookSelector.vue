<template>
  <div class="book-selector">
    <!-- 書卷選擇器 -->
    <v-select
      v-model="selectedBook"
      :items="bookItems"
      item-title="name"
      item-value="id"
      label="聖經書卷"
      variant="outlined"
      density="compact"
      class="book-select"
      :disabled="!bibleStore.currentVersion"
      @update:model-value="(value) => handleBookChange(value as unknown as number)"
    >
      <template v-slot:item="{ props, item }">
        <v-list-item v-bind="props">
          <template v-slot:title>
            <div class="book-item">
              <span class="book-name">{{ item.raw.name }}</span>
              <span class="book-abbr">({{ item.raw.abbreviation }})</span>
            </div>
          </template>
        </v-list-item>
      </template>
      <template v-slot:selection="{ item }">
        {{ item.raw.name }}
      </template>
    </v-select>

    <!-- 書卷網格選擇器 -->
    <v-dialog v-model="showBookGrid" max-width="800">
      <template v-slot:activator="{ props }">
        <v-btn
          v-bind="props"
          variant="outlined"
          :disabled="!bibleStore.currentVersion"
          class="book-grid-btn"
        >
          <v-icon class="mr-2">mdi-book-open-variant</v-icon>
          選擇書卷
        </v-btn>
      </template>

      <v-card>
        <v-card-title>
          <v-icon class="mr-2">mdi-book-open-variant</v-icon>
          選擇聖經書卷
        </v-card-title>

        <v-card-text>
          <transition name="page-slide" mode="out-in">
            <!-- 書卷選擇視圖 -->
            <div v-if="currentView === 'books'" key="books">
              <!-- 舊約書卷 -->
              <div class="testament-section">
                <h3 class="testament-title">舊約 (39卷)</h3>
                <v-row>
                  <v-col v-for="book in oldTestamentBooks" :key="book.id" cols="3" sm="3" md="3">
                    <v-card
                      class="book-card"
                      :class="{ selected: selectedBook?.id === book.id }"
                      @click="selectBook(book)"
                    >
                      <v-card-text class="text-center pa-2">
                        <div class="book-number">{{ book.number }}</div>
                        <div class="book-name">{{ book.name }}</div>
                        <div class="book-abbr">{{ book.abbreviation }}</div>
                      </v-card-text>
                    </v-card>
                  </v-col>
                </v-row>
              </div>

              <!-- 新約書卷 -->
              <div class="testament-section mt-6">
                <h3 class="testament-title">新約 (27卷)</h3>
                <v-row>
                  <v-col v-for="book in newTestamentBooks" :key="book.id" cols="3" sm="3" md="3">
                    <v-card
                      class="book-card"
                      :class="{ selected: selectedBook?.id === book.id }"
                      @click="selectBook(book)"
                    >
                      <v-card-text class="text-center pa-2">
                        <div class="book-number">{{ book.number }}</div>
                        <div class="book-name">{{ book.name }}</div>
                        <div class="book-abbr">{{ book.abbreviation }}</div>
                      </v-card-text>
                    </v-card>
                  </v-col>
                </v-row>
              </div>
            </div>

            <!-- 章節選擇視圖 -->
            <div v-else-if="currentView === 'chapters'" key="chapters">
              <div class="chapter-header">
                <v-btn icon variant="text" @click="currentView = 'books'" class="back-btn">
                  <v-icon>mdi-arrow-left</v-icon>
                </v-btn>
                <h3 class="chapter-title">{{ selectedBook?.name }} - 選擇章節</h3>
              </div>

              <div class="chapters-container">
                <div
                  v-for="(chapterGroup, groupIndex) in chapterGroups"
                  :key="groupIndex"
                  class="chapter-group"
                >
                  <v-row>
                    <v-col v-for="chapter in chapterGroup" :key="chapter.id" cols="1" sm="1" md="1">
                      <v-card
                        class="chapter-card"
                        :class="{ selected: selectedChapter?.id === chapter.id }"
                        @click="selectChapter(chapter)"
                      >
                        <v-card-text class="text-center pa-1">
                          <div class="chapter-number">{{ chapter.number }}</div>
                        </v-card-text>
                      </v-card>
                    </v-col>
                  </v-row>
                </div>
              </div>
            </div>

            <!-- 經節選擇視圖 -->
            <div v-else-if="currentView === 'verses'" key="verses">
              <div class="verse-header">
                <v-btn icon variant="text" @click="currentView = 'chapters'" class="back-btn">
                  <v-icon>mdi-arrow-left</v-icon>
                </v-btn>
                <h3 class="verse-title">
                  {{ selectedBook?.name }} {{ selectedChapter?.number }}章 - 選擇經節
                </h3>
              </div>

              <div class="verses-container">
                <div
                  v-for="(verseGroup, groupIndex) in verseGroups"
                  :key="groupIndex"
                  class="verse-group"
                >
                  <v-row>
                    <v-col v-for="verse in verseGroup" :key="verse.id" cols="1" sm="1" md="1">
                      <v-card
                        class="verse-card"
                        :class="{ selected: selectedVerse?.id === verse.id }"
                        @click="selectVerse(verse)"
                      >
                        <v-card-text class="text-center pa-1">
                          <div class="verse-number">{{ verse.number }}</div>
                        </v-card-text>
                      </v-card>
                    </v-col>
                  </v-row>
                </div>
              </div>
            </div>
          </transition>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn @click="showBookGrid = false">關閉</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useBibleStore } from '@/stores/bible'
import type { BibleBook, BibleChapter, BibleVerse } from '@/stores/bible'

const bibleStore = useBibleStore()

// 本地狀態
const showBookGrid = ref(false)
const currentView = ref<'books' | 'chapters' | 'verses'>('books')
const selectedBook = ref<BibleBook | null>(null)
const selectedChapter = ref<BibleChapter | null>(null)
const selectedVerse = ref<BibleVerse | null>(null)

// 計算屬性
const bookItems = computed(() => {
  if (!bibleStore.bibleContent) return []
  return bibleStore.bibleContent.books.map((book) => ({
    id: book.id,
    name: book.name,
    abbreviation: book.abbreviation,
    number: book.number,
  }))
})

const oldTestamentBooks = computed(() => {
  return bibleStore.oldTestamentBooks
})

const newTestamentBooks = computed(() => {
  return bibleStore.newTestamentBooks
})

// 章節分組 (每10個一組)
const chapterGroups = computed(() => {
  if (!selectedBook.value?.chapters) return []
  const chapters = selectedBook.value.chapters
  const groups = []
  for (let i = 0; i < chapters.length; i += 10) {
    groups.push(chapters.slice(i, i + 10))
  }
  return groups
})

// 經節分組 (每10個一組)
const verseGroups = computed(() => {
  if (!selectedChapter.value?.verses) return []
  const verses = selectedChapter.value.verses
  const groups = []
  for (let i = 0; i < verses.length; i += 10) {
    groups.push(verses.slice(i, i + 10))
  }
  return groups
})

// 方法
const selectBook = (book: BibleBook) => {
  selectedBook.value = book
  bibleStore.selectBook(book)
  currentView.value = 'chapters'
}

const selectChapter = (chapter: BibleChapter) => {
  selectedChapter.value = chapter
  bibleStore.selectChapter(chapter)
  currentView.value = 'verses'
}

const selectVerse = (verse: BibleVerse) => {
  selectedVerse.value = verse
  bibleStore.selectVerse(verse)
  showBookGrid.value = false
}

const handleBookChange = (bookId: number) => {
  const book = bibleStore.bibleContent?.books.find((b) => b.id === bookId)
  if (book) {
    bibleStore.selectBook(book)
  }
}

// 監聽 store 變化
watch(
  () => bibleStore.selectedBook,
  (newBook) => {
    selectedBook.value = newBook
    if (newBook) {
      currentView.value = 'chapters'
    }
  },
)

watch(
  () => bibleStore.selectedChapter,
  (newChapter) => {
    selectedChapter.value = newChapter
    if (newChapter) {
      currentView.value = 'verses'
    }
  },
)

watch(
  () => bibleStore.selectedVerse,
  (newVerse) => {
    selectedVerse.value = newVerse
  },
)
</script>

<style scoped>
.book-selector {
  display: flex;
  gap: 12px;
  align-items: center;
}

.book-select {
  min-width: 200px;
  max-width: 300px;
}

.book-grid-btn {
  min-width: 140px;
}

.book-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.book-name {
  font-weight: 500;
}

.book-abbr {
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-size: 0.875rem;
}

.testament-section {
  margin-bottom: 24px;
}

.testament-title {
  color: rgba(var(--v-theme-on-surface), 0.87);
  font-size: 1.25rem;
  font-weight: 500;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid rgba(var(--v-theme-primary), 0.3);
}

.book-card {
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.book-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.book-card.selected {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.1);
}

.book-number {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-bottom: 4px;
}

.book-name {
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.2;
  margin-bottom: 2px;
}

.book-abbr {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.chapter-header,
.verse-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.back-btn {
  margin-right: 12px;
}

.chapter-title,
.verse-title {
  color: rgba(var(--v-theme-on-surface), 0.87);
  font-size: 1.125rem;
  font-weight: 500;
  margin: 0;
}

.chapter-card,
.verse-card {
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.chapter-card:hover,
.verse-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.chapter-card.selected,
.verse-card.selected {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.1);
}

.chapter-number,
.verse-number {
  font-size: 0.875rem;
  font-weight: 500;
}

.chapters-container,
.verses-container {
  max-height: 400px;
  overflow-y: auto;
}

.chapter-group,
.verse-group {
  margin-bottom: 12px;
}

.chapter-group:last-child,
.verse-group:last-child {
  margin-bottom: 0;
}

/* 切換動畫 */
.page-slide-enter-active,
.page-slide-leave-active {
  transition: all 0.3s ease;
}

.page-slide-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.page-slide-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

@media (max-width: 768px) {
  .book-selector {
    flex-direction: column;
    align-items: stretch;
  }

  .book-select {
    max-width: none;
  }

  .book-grid-btn {
    width: 100%;
  }
}
</style>
