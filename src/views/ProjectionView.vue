<template>
  <v-app class="projection-app">
    <v-main class="projection-main">
      <v-container fluid class="pa-0 fill-height projection-container">
        <!-- 預設內容 -->
        <transition name="fade" mode="out-in">
          <DefaultProjection v-if="projectionStore.isShowingDefault" key="default" />

          <!-- 聖經投影內容 -->
          <BibleProjection
            v-else-if="projectionStore.currentView === 'bible'"
            key="bible"
            :selected-book="selectedBook"
            :selected-chapter="selectedChapter"
            :bible-content="bibleContent"
          />

          <!-- 計時器投影內容 -->
          <TimerProjection
            v-else-if="projectionStore.currentView === 'timer'"
            key="timer"
            :timer-mode="timerMode"
            :timer-formatted-time="timerFormattedTime"
            :clock-formatted-time="clockFormattedTime"
            :selected-timezone="selectedTimezone"
            :timer-progress="timerProgress"
          />

          <!-- 其他內容預設顯示 DefaultProjection -->
          <DefaultProjection v-else key="fallback" />
        </transition>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import BibleProjection from '@/components/Bible/BibleProjection.vue'
import TimerProjection from '@/components/Timer/TimerProjection.vue'
import DefaultProjection from '@/components/Default/DefaultProjection.vue'
import { useProjectionStore } from '@/stores/projection'
import { useProjectionElectron } from '@/composables/useElectron'
import type { AppMessage } from '@/types/common'

// 使用 projection store
const projectionStore = useProjectionStore()

// 使用投影專用的 Electron composable
const {
  isElectron,
  handleMessage: setupMessageHandler,
  requestCurrentState,
  removeAllListeners,
} = useProjectionElectron()

// 響應式變數
const selectedBook = ref('創世記')
const selectedChapter = ref(1)
const bibleContent = ref('')

// 計時器相關
const timerMode = ref<'timer' | 'clock' | 'both'>('both')
const timerFormattedTime = ref('05:00')
const clockFormattedTime = ref('12:00:00')
const selectedTimezone = ref('Asia/Taipei')
const timerProgress = ref(0)

// 計時器
let timer: number | undefined

// 監聽來自主窗口的消息
const handleMessage = (data: AppMessage) => {
  const { type, data: messageData } = data as { type: string; data: Record<string, unknown> }

  switch (type) {
    case 'CHANGE_VIEW':
      projectionStore.setCurrentView(messageData.view as string)
      break
    case 'UPDATE_BIBLE':
      selectedBook.value = messageData.book as string
      selectedChapter.value = messageData.chapter as number
      bibleContent.value = messageData.content as string
      break
    case 'UPDATE_TIMER':
      timerMode.value = messageData.mode as 'timer' | 'clock' | 'both'
      timerFormattedTime.value = messageData.formattedTime as string
      selectedTimezone.value = messageData.timezone as string
      timerProgress.value = (messageData.progress as number) || 0
      // 更新時鐘時間
      if (messageData.clockFormattedTime) {
        clockFormattedTime.value = messageData.clockFormattedTime as string
      }
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

  // 啟動計時器
  timer = window.setInterval(() => {
    const now = new Date()
    clockFormattedTime.value = now.toLocaleTimeString('en-US', {
      timeZone: selectedTimezone.value,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }, 1000)

  // 請求當前狀態
  requestCurrentState()
})

onBeforeUnmount(() => {
  // 清理監聽器
  if (isElectron()) {
    removeAllListeners('projection-message')
  }

  if (timer) {
    clearInterval(timer)
  }
})
</script>

<style scoped>
.projection-app {
  background: var(--projection-background-color);
  color: var(--projection-text-color);
}

.projection-main {
  background: transparent;
}

/* 淡入淡出動畫 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-to,
.fade-leave-from {
  opacity: 1;
}
</style>
