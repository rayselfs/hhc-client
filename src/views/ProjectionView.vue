<template>
  <v-app>
    <v-main class="fill-height h-100 w-100">
      <v-container fluid class="fill-height pa-0 bg-black text-white">
        <component :is="currentComponent" :key="componentKey" v-bind="componentProps" />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import DefaultProjection from '@/layouts/projection/DefaultProjection.vue'
import BibleProjection from '@/layouts/projection/BibleProjection.vue'
import TimerProjection from '@/layouts/projection/TimerProjection.vue'
import { useProjectionStore } from '@/stores/projection'
import { useProjectionElectron } from '@/composables/useElectron'
import { TimerMode, type AppMessage } from '@/types/common'

const projectionStore = useProjectionStore()

const {
  isElectron,
  handleMessage: setupMessageHandler,
  requestCurrentState,
  removeAllListeners,
} = useProjectionElectron()

// 聖經相關
const selectedBook = ref('創世記')
const selectedBookNumber = ref(1) // 書卷編號
const selectedChapter = ref(1)
const chapterVerses = ref<Array<{ number: number; text: string }>>([])
const currentVerse = ref(1)
const getInitialFontSize = () => {
  const savedFontSize = localStorage.getItem('bible-font-size')
  return savedFontSize ? parseInt(savedFontSize, 10) : 90
}
const verseFontSize = ref(getInitialFontSize())

// 計時器相關
const timerMode = ref(TimerMode.BOTH)
const timerFormattedTime = ref('05:00')
const selectedTimezone = ref('Asia/Taipei')
const timerProgress = ref(0)

// 動態組件配置
const currentComponent = computed(() => {
  if (projectionStore.isShowingDefault) {
    return DefaultProjection
  }

  switch (projectionStore.currentView) {
    case 'bible':
      return BibleProjection
    case 'timer':
      return TimerProjection
    default:
      return DefaultProjection
  }
})

const componentKey = computed(() => {
  if (projectionStore.isShowingDefault) {
    return 'default'
  }
  return projectionStore.currentView || 'fallback'
})

const componentProps = computed(() => {
  if (projectionStore.isShowingDefault) {
    return {}
  }

  switch (projectionStore.currentView) {
    case 'bible':
      return {
        selectedBook: selectedBook.value,
        selectedBookNumber: selectedBookNumber.value,
        selectedChapter: selectedChapter.value,
        chapterVerses: chapterVerses.value,
        currentVerse: currentVerse.value,
        fontSize: verseFontSize.value,
      }
    case 'timer':
      return {
        timerMode: timerMode.value,
        timerFormattedTime: timerFormattedTime.value,
        selectedTimezone: selectedTimezone.value,
        timerProgress: timerProgress.value,
      }
    default:
      return {}
  }
})

// 監聽來自主窗口的消息
const handleMessage = (data: AppMessage) => {
  const { type, data: messageData } = data as { type: string; data: Record<string, unknown> }

  switch (type) {
    case 'CHANGE_VIEW':
      projectionStore.setCurrentView(messageData.view as string)
      break
    case 'UPDATE_BIBLE':
      selectedBook.value = messageData.book as string
      selectedBookNumber.value = messageData.bookNumber as number
      selectedChapter.value = messageData.chapter as number
      chapterVerses.value = messageData.chapterVerses as Array<{ number: number; text: string }>
      currentVerse.value = messageData.currentVerse as number
      break
    case 'UPDATE_BIBLE_FONT_SIZE':
      verseFontSize.value = messageData.fontSize as number
      break
    case 'UPDATE_TIMER':
      timerMode.value = messageData.mode as TimerMode
      timerFormattedTime.value = messageData.formattedTime as string
      selectedTimezone.value = messageData.timezone as string
      timerProgress.value = (messageData.progress as number) || 0
      break
    case 'TOGGLE_PROJECTION_CONTENT':
      projectionStore.setShowingDefault(messageData.showDefault as boolean)
      break
  }
}

// 生命週期
onMounted(() => {
  // 監聽消息
  setupMessageHandler(handleMessage)

  // 請求當前狀態
  requestCurrentState()

  // 設置 html overflow 為 hidden（只在投影視圖）
  document.documentElement.style.overflow = 'hidden'
})

onBeforeUnmount(() => {
  // 清理監聽器
  if (isElectron()) {
    removeAllListeners('projection-message')
  }

  // 恢復 html overflow（清理樣式）
  document.documentElement.style.overflow = ''
})
</script>

<style scoped></style>
