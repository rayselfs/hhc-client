<template>
  <div class="bible-projection">
    <div class="bible-header">
      <div class="bible-header-text text-black">
        {{ formattedTitle }}
      </div>
    </div>

    <div class="bible-content bg-black" ref="bibleContentRef">
      <div
        v-for="verse in chapterVerses"
        :key="verse.number"
        :id="`verse-${verse.number}`"
        class="verse-item pt-5 pb-5 d-flex text-justify"
        :style="{ fontSize: `${props.fontSize}px` }"
      >
        <span class="verse-number">{{ verse.number }}</span>
        <span class="verse-text">{{ verse.text }}</span>
      </div>

      <BottomSpacer />
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
}

const props = defineProps<Props>()
const bibleContentRef = ref<HTMLElement>()
const { t: $t, locale } = useI18n()

const isInitialLoad = ref(true)

import { BibleBookConfig } from '@/types/bible'
import { BIBLE_BOOKS } from '@/config/app'

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
  const element = document.getElementById(`verse-${verseNumber}`)
  if (element && bibleContentRef.value) {
    element.scrollIntoView({
      behavior: isInitialLoad.value ? 'instant' : 'smooth',
      block: 'start',
    })

    if (isInitialLoad.value) {
      isInitialLoad.value = false
    }
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
