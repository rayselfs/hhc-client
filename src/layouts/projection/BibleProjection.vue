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

// 追蹤是否為初始載入
const isInitialLoad = ref(true)

import { BibleBookConfig } from '@/types/bible'

// 判斷是否為詩篇 (書卷編號 19)
const isPsalms = computed(() => {
  return props.selectedBookNumber === BibleBookConfig.PSALMS
})

// 判斷是否為猶大書 (書卷編號 65)
const isJude = computed(() => {
  return props.selectedBookNumber === BibleBookConfig.JUDE
})

// 格式化標題
const formattedTitle = computed(() => {
  // 保留中文if else 方便之後擴展locale
  if (locale.value === 'zh') {
  }

  if (isJude.value) {
    // 猶大書：只顯示節
    return `${props.selectedBook} ${$t('bible.no')} ${props.currentVerse} ${$t('bible.verse')}`
  } else if (isPsalms.value) {
    // 詩篇：章改為篇
    return `${props.selectedBook} ${$t('bible.no')} ${props.selectedChapter} ${$t('bible.psalm')} ${$t('bible.no')} ${props.currentVerse} ${$t('bible.verse')}`
  } else {
    // 一般書卷：章節
    return `${props.selectedBook} ${$t('bible.no')} ${props.selectedChapter} ${$t('bible.chapter')} ${$t('bible.no')} ${props.currentVerse} ${$t('bible.verse')}`
  }
})

// 滾動到指定節
const scrollToVerse = async (verseNumber: number) => {
  await nextTick()
  const element = document.getElementById(`verse-${verseNumber}`)
  if (element && bibleContentRef.value) {
    element.scrollIntoView({
      behavior: isInitialLoad.value ? 'instant' : 'smooth',
      block: 'start',
    })

    // 第一次滾動後，將初始載入標記設為 false
    if (isInitialLoad.value) {
      isInitialLoad.value = false
    }
  }
}

// 監聽當前節數變化
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
