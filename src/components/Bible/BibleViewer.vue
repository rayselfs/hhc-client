<template>
  <div class="bible-viewer">
    <!-- 載入狀態 -->
    <v-progress-linear v-if="bibleStore.isLoading" indeterminate color="primary" class="mb-4" />

    <!-- 錯誤訊息 -->
    <v-alert v-if="bibleStore.error" type="error" variant="tonal" class="mb-4">
      {{ bibleStore.error }}
    </v-alert>

    <!-- 聖經內容顯示 -->
    <v-card v-if="bibleStore.selectedVerse" class="bible-content-card">
      <v-card-title class="bible-header">
        <div class="bible-reference">
          <v-icon class="mr-2">mdi-book-open-variant</v-icon>
          {{ bibleStore.selectedBook?.name }} {{ bibleStore.selectedChapter?.number }}:{{
            bibleStore.selectedVerse.number
          }}
        </div>
        <div class="bible-version">
          {{ bibleStore.currentVersion?.name }}
        </div>
      </v-card-title>

      <v-card-text class="bible-text">
        <div class="verse-content">
          <span class="verse-number">{{ bibleStore.selectedVerse.number }}</span>
          <span class="verse-text">{{ bibleStore.selectedVerse.text }}</span>
        </div>
      </v-card-text>
    </v-card>

    <!-- 章節內容顯示 -->
    <v-card v-else-if="bibleStore.selectedChapter" class="bible-content-card">
      <v-card-title class="bible-header">
        <div class="bible-reference">
          <v-icon class="mr-2">mdi-book-open-variant</v-icon>
          {{ bibleStore.selectedBook?.name }} 第{{ bibleStore.selectedChapter.number }}章
        </div>
        <div class="bible-version">
          {{ bibleStore.currentVersion?.name }}
        </div>
      </v-card-title>

      <v-card-text class="bible-text">
        <div
          v-for="verse in bibleStore.currentVerses"
          :key="verse.id"
          class="verse-item"
          @click="selectVerse(verse)"
        >
          <span class="verse-number">{{ verse.number }}</span>
          <span class="verse-text">{{ verse.text }}</span>
        </div>
      </v-card-text>
    </v-card>

    <!-- 書卷內容顯示 -->
    <v-card v-else-if="bibleStore.selectedBook" class="bible-content-card">
      <v-card-title class="bible-header">
        <div class="bible-reference">
          <v-icon class="mr-2">mdi-book-open-variant</v-icon>
          {{ bibleStore.selectedBook.name }}
        </div>
        <div class="bible-version">
          {{ bibleStore.currentVersion?.name }}
        </div>
      </v-card-title>

      <v-card-text class="bible-text">
        <div class="chapters-container">
          <div
            v-for="(chapterGroup, groupIndex) in chapterGroups"
            :key="groupIndex"
            class="chapter-group"
          >
            <div class="chapters-row">
              <v-card
                v-for="chapter in chapterGroup"
                :key="chapter.id"
                class="chapter-card"
                @click="selectChapter(chapter)"
              >
                <v-card-text class="text-center pa-2">
                  <div class="chapter-number">{{ chapter.number }}</div>
                  <div class="chapter-label">章</div>
                </v-card-text>
              </v-card>
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- 預設狀態 -->
    <v-card v-else class="bible-content-card">
      <v-card-title>
        <v-icon class="mr-2">mdi-book-open-variant</v-icon>
        聖經閱讀器
      </v-card-title>
      <v-card-text>
        <div class="empty-state">
          <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-book-open-variant</v-icon>
          <h3 class="text-h6 mb-2">選擇聖經版本開始閱讀</h3>
          <p class="text-body-2 text-grey">請先選擇聖經版本，然後選擇書卷、章節和經節</p>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBibleStore } from '@/stores/bible'
import type { BibleChapter, BibleVerse } from '@/stores/bible'

const bibleStore = useBibleStore()

// 章節分組 (每10個一組)
const chapterGroups = computed(() => {
  if (!bibleStore.selectedBook?.chapters) return []
  const chapters = bibleStore.selectedBook.chapters
  const groups = []
  for (let i = 0; i < chapters.length; i += 10) {
    groups.push(chapters.slice(i, i + 10))
  }
  return groups
})

// 方法
const selectChapter = (chapter: BibleChapter) => {
  bibleStore.selectChapter(chapter)
}

const selectVerse = (verse: BibleVerse) => {
  bibleStore.selectVerse(verse)
}
</script>

<style scoped>
.bible-viewer {
  height: 100%;
  overflow-y: auto;
}

.bible-content-card {
  margin-bottom: 16px;
}

.bible-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.bible-reference {
  display: flex;
  align-items: center;
  font-size: 1.25rem;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.87);
}

.bible-version {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.bible-text {
  padding-top: 16px;
}

.verse-content {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 16px;
  padding: 12px;
  background-color: rgba(var(--v-theme-primary), 0.05);
  border-radius: 8px;
  border-left: 4px solid rgb(var(--v-theme-primary));
}

.verse-number {
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
  min-width: 24px;
  flex-shrink: 0;
}

.verse-text {
  line-height: 1.6;
  font-size: 1.1rem;
}

.verse-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.verse-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
}

.chapters-container {
  max-height: 400px;
  overflow-y: auto;
}

.chapter-group {
  margin-bottom: 12px;
}

.chapter-group:last-child {
  margin-bottom: 0;
}

.chapters-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.chapter-card {
  cursor: pointer;
  transition: all 0.2s ease;
}

.chapter-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.chapter-number {
  font-size: 1.5rem;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}

.chapter-label {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-top: 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

@media (max-width: 768px) {
  .bible-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .chapters-row {
    gap: 4px;
  }

  .chapter-card {
    min-width: 50px;
    flex: 0 0 auto;
  }

  .verse-content,
  .verse-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
