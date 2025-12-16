<template>
  <div class="bible-projection">
    <div class="bible-header">
      <div class="bible-header-text text-black">
        {{ formattedTitle }}
      </div>
    </div>

    <!-- Single Version Mode -->
    <div v-if="!isMultiVersion" class="bible-content bg-black" ref="bibleContentRef">
      <div
        v-for="verse in chapterVerses"
        :key="verse.number"
        :id="`verse-${verse.number}`"
        class="verse-item pt-5 pb-5 d-flex text-justify"
        :style="{ fontSize: `${computedFontSize}px` }"
      >
        <span class="verse-number">{{ verse.number }}</span>
        <span class="verse-text">{{ verse.text }}</span>
      </div>

      <BottomSpacer />
    </div>

    <!-- Dual Version Mode -->
    <div v-else class="dual-version-container">
      <!-- Top Pane (Primary Version) -->
      <div class="split-pane top-pane bg-black" ref="topPaneRef">
        <div
          v-for="verse in chapterVerses"
          :key="`v1-${verse.number}`"
          :id="`v1-verse-${verse.number}`"
          class="verse-item pt-5 pb-5 d-flex text-justify"
          :style="{ fontSize: `${computedFontSize}px` }"
        >
          <span class="verse-number">{{ verse.number }}</span>
          <span class="verse-text">{{ verse.text }}</span>
        </div>
        <BottomSpacer />
      </div>

      <!-- Divider -->
      <div class="split-divider"></div>

      <!-- Bottom Pane (Secondary Version) -->
      <div class="split-pane bottom-pane bg-black" ref="bottomPaneRef">
        <div
          v-for="verse in secondVersionChapterVerses"
          :key="`v2-${verse.number}`"
          :id="`v2-verse-${verse.number}`"
          class="verse-item pt-5 pb-5 d-flex text-justify"
          :style="{ fontSize: `${computedFontSize}px` }"
        >
          <span class="verse-number">{{ verse.number }}</span>
          <span class="verse-text">{{ verse.text }}</span>
        </div>
        <BottomSpacer />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BottomSpacer from '@/components/Main/BottomSpacer.vue'

interface BibleVerse {
  number: number
  text: string
}

interface Props {
  selectedBook: string
  selectedBookNumber: number
  selectedChapter: number
  chapterVerses: BibleVerse[]
  currentVerse: number
  fontSize?: number
  isMultiVersion?: boolean
  secondVersionChapterVerses?: BibleVerse[]
}

const props = defineProps<Props>()
const bibleContentRef = ref<HTMLElement>()
const topPaneRef = ref<HTMLElement>()
const bottomPaneRef = ref<HTMLElement>()
const { t: $t, locale } = useI18n()

const isInitialLoad = ref(true)

const computedFontSize = computed(() => {
  const baseSize = props.fontSize || 90 // Default fallback
  if (props.isMultiVersion) {
    return baseSize * BIBLE_CONFIG.FONT.DUAL_VERSION_SCALE
  }
  return baseSize
})

import { BibleBookConfig } from '@/types/bible'
import { BIBLE_BOOKS, BIBLE_CONFIG } from '@/config/app'

const isPsalms = computed(() => {
  return props.selectedBookNumber === BibleBookConfig.PSALMS
})

const isJude = computed(() => {
  return props.selectedBookNumber === BibleBookConfig.JUDE
})

const formattedTitle = computed(() => {
  const bookConfig = BIBLE_BOOKS.find((b) => b.number === props.selectedBookNumber)
  const bookName = bookConfig
    ? ($t(`bible.books.${bookConfig.code}`) as string)
    : props.selectedBook

  if (locale.value === 'en') {
    return `${bookName} ${props.selectedChapter}:${props.currentVerse}`
  }

  if (isJude.value) {
    return `${bookName} ${$t('bible.no')} ${props.currentVerse} ${$t('bible.verse')}`
  } else if (isPsalms.value) {
    return `${bookName} ${$t('bible.no')} ${props.selectedChapter} ${$t('bible.psalm')} ${$t('bible.no')} ${props.currentVerse} ${$t('bible.verse')}`
  } else {
    return `${bookName} ${$t('bible.no')} ${props.selectedChapter} ${$t('bible.chapter')} ${$t('bible.no')} ${props.currentVerse} ${$t('bible.verse')}`
  }
})

const scrollToVerse = async (verseNumber: number) => {
  await nextTick()

  const behavior = isInitialLoad.value ? 'instant' : 'smooth'

  if (props.isMultiVersion) {
    // Scroll top pane
    const el1 = document.getElementById(`v1-verse-${verseNumber}`)
    if (el1 && topPaneRef.value) {
      el1.scrollIntoView({ behavior, block: 'start' })
    }

    // Scroll bottom pane
    const el2 = document.getElementById(`v2-verse-${verseNumber}`)
    if (el2 && bottomPaneRef.value) {
      el2.scrollIntoView({ behavior, block: 'start' })
    }
  } else {
    // Scroll single pane
    const element = document.getElementById(`verse-${verseNumber}`)
    if (element && bibleContentRef.value) {
      element.scrollIntoView({ behavior, block: 'start' })
    }
  }

  if (isInitialLoad.value) {
    isInitialLoad.value = false
  }
}

watch(
  () => props.currentVerse,
  (newVerse) => {
    if (newVerse) {
      scrollToVerse(newVerse)
    }
  },
)

// Watch mode change to re-trigger scroll
watch(
  () => props.isMultiVersion,
  () => {
    if (props.currentVerse) {
      scrollToVerse(props.currentVerse)
    }
  },
)

onMounted(() => {
  if (props.currentVerse) {
    scrollToVerse(props.currentVerse)
  }
})
</script>

<style scoped>
.bible-projection {
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #f5f5f5;
}

.bible-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background-color: white;
  padding: 12px;
  text-align: center;
  height: 60px;
}

.bible-header-text {
  font-size: 2rem;
  font-weight: bold;
}

.bible-content {
  flex: 1;
  overflow-y: hidden;
  margin-top: 60px;
  scrollbar-width: none;
  -ms-overflow-style: none;
  pointer-events: none;
}

/* Dual Version Styles */
.dual-version-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-top: 60px;
  height: calc(100vh - 60px);
  overflow: hidden;
}

.split-pane {
  flex: 1;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  pointer-events: none;
}

.split-pane::-webkit-scrollbar {
  display: none;
}

.split-divider {
  height: 2px;
  background-color: #eee;
  z-index: 10;
}

.bible-content::-webkit-scrollbar {
  display: none;
}

.verse-item {
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  border-radius: 8px;
  transition: all 0.3s ease;
  pointer-events: auto;
  line-height: 150%;
}

.verse-number {
  min-width: 1.2em;
  text-align: right;
  font-weight: bold;
  flex-shrink: 0; /* 防止縮小 */
  margin-right: 0.5rem;
}

.verse-text {
  flex: 1;
  text-align: justify;
}
</style>
