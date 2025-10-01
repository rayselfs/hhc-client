<template>
  <div class="bible-selector">
    <!-- 版本選擇器 -->
    <v-select
      v-model="selectedVersion"
      :items="versionItems"
      item-title="name"
      item-value="id"
      label="聖經版本"
      variant="outlined"
      density="compact"
      class="version-select"
      @update:model-value="handleVersionChange"
    />

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
      @update:model-value="handleBookChange"
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

    <!-- 章節選擇器 -->
    <v-select
      v-model="selectedChapter"
      :items="chapterItems"
      item-title="number"
      item-value="id"
      label="章節"
      variant="outlined"
      density="compact"
      class="chapter-select"
      :disabled="!bibleStore.selectedBook"
      @update:model-value="handleChapterChange"
    />

    <!-- 經節選擇器 -->
    <v-select
      v-model="selectedVerse"
      :items="verseItems"
      item-title="number"
      item-value="id"
      label="經節"
      variant="outlined"
      density="compact"
      class="verse-select"
      :disabled="!bibleStore.selectedChapter"
      @update:model-value="handleVerseChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useBibleStore } from '@/stores/bible'
import type { BibleVersion, BibleBook, BibleChapter, BibleVerse } from '@/stores/bible'

const bibleStore = useBibleStore()

// 本地狀態
const selectedVersion = ref<number | null>(null)
const selectedBook = ref<number | null>(null)
const selectedChapter = ref<number | null>(null)
const selectedVerse = ref<number | null>(null)

// 計算屬性
const versionItems = computed(() => {
  return bibleStore.versions.map((version) => ({
    id: version.id,
    name: version.name,
    code: version.code,
  }))
})

const bookItems = computed(() => {
  if (!bibleStore.bibleContent) return []
  return bibleStore.bibleContent.books.map((book) => ({
    id: book.id,
    name: book.name,
    abbreviation: book.abbreviation,
    number: book.number,
  }))
})

const chapterItems = computed(() => {
  if (!bibleStore.selectedBook) return []
  const book = bibleStore.bibleContent?.books.find((b) => b.id === bibleStore.selectedBook?.id)
  if (!book) return []
  return book.chapters.map((chapter) => ({
    id: chapter.id,
    number: chapter.number,
  }))
})

const verseItems = computed(() => {
  if (!bibleStore.selectedChapter) return []
  return bibleStore.selectedChapter.verses.map((verse) => ({
    id: verse.id,
    number: verse.number,
  }))
})

// 事件處理
const handleVersionChange = async (versionId: number) => {
  const version = bibleStore.versions.find((v) => v.id === versionId)
  if (version) {
    await bibleStore.selectVersion(version)
    // 重置其他選擇
    selectedBook.value = null
    selectedChapter.value = null
    selectedVerse.value = null
  }
}

const handleBookChange = (bookId: number) => {
  const book = bibleStore.bibleContent?.books.find((b) => b.id === bookId)
  if (book) {
    bibleStore.selectBook(book)
    // 重置章節和經節選擇
    selectedChapter.value = null
    selectedVerse.value = null
  }
}

const handleChapterChange = (chapterId: number) => {
  const chapter = bibleStore.selectedBook?.chapters.find((c) => c.id === chapterId)
  if (chapter) {
    bibleStore.selectChapter(chapter)
    // 重置經節選擇
    selectedVerse.value = null
  }
}

const handleVerseChange = (verseId: number) => {
  const verse = bibleStore.selectedChapter?.verses.find((v) => v.id === verseId)
  if (verse) {
    bibleStore.selectVerse(verse)
  }
}

// 監聽 store 變化
watch(
  () => bibleStore.selectedBook,
  (newBook) => {
    if (newBook) {
      selectedBook.value = newBook.id
    } else {
      selectedBook.value = null
    }
  },
)

watch(
  () => bibleStore.selectedChapter,
  (newChapter) => {
    if (newChapter) {
      selectedChapter.value = newChapter.id
    } else {
      selectedChapter.value = null
    }
  },
)

watch(
  () => bibleStore.selectedVerse,
  (newVerse) => {
    if (newVerse) {
      selectedVerse.value = newVerse.id
    } else {
      selectedVerse.value = null
    }
  },
)

// 初始化
onMounted(async () => {
  if (bibleStore.versions.length === 0) {
    await bibleStore.initialize()
  }
})
</script>

<style scoped>
.bible-selector {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.version-select,
.book-select,
.chapter-select,
.verse-select {
  min-width: 120px;
  max-width: 200px;
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

@media (max-width: 768px) {
  .bible-selector {
    flex-direction: column;
    align-items: stretch;
  }

  .version-select,
  .book-select,
  .chapter-select,
  .verse-select {
    max-width: none;
  }
}
</style>
