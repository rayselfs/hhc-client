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
import { useTimerStore } from '@/stores/timer'
import { useProjectionElectron } from '@/composables/useElectron'
import { type AppMessage, StorageKey, StorageCategory, getStorageKey } from '@/types/common'
import { useLocalStorage } from '@/composables/useLocalStorage'
import { BIBLE_CONFIG } from '@/config/app'

const projectionStore = useProjectionStore()
const timerStore = useTimerStore()
const { getLocalItem } = useLocalStorage()

const {
  isElectron,
  handleMessage: setupMessageHandler,
  requestCurrentState,
  removeAllListeners,
} = useProjectionElectron()

// bible
const selectedBook = ref('創世記')
const selectedBookNumber = ref(1)
const selectedChapter = ref(1)
const chapterVerses = ref<Array<{ number: number; text: string }>>([])
const currentVerse = ref(1)
const getInitialFontSize = () => {
  const savedFontSize = getLocalItem<number>(
    getStorageKey(StorageCategory.BIBLE, StorageKey.FONT_SIZE),
    'int',
  )
  return savedFontSize ? savedFontSize : BIBLE_CONFIG.FONT.DEFAULT_SIZE
}
const verseFontSize = ref(getInitialFontSize())

// timer
const timerMode = computed(() => timerStore.settings.mode)
const timerFormattedTime = computed(() => timerStore.formattedTime)
const selectedTimezone = computed(() => timerStore.settings.timezone)
const timerProgress = computed(() => timerStore.progress)
const isWarning = computed(() => timerStore.isWarning)
const isFinished = computed(() => timerStore.isFinished)
const overtimeMessageEnabled = computed(() => timerStore.settings.overtimeMessageEnabled)
const overtimeMessage = computed(() => timerStore.settings.overtimeMessage)

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
        isWarning: isWarning.value,
        isFinished: isFinished.value,
        overtimeMessageEnabled: overtimeMessageEnabled.value,
        overtimeMessage: overtimeMessage.value,
      }
    default:
      return {}
  }
})

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
      verseFontSize.value = Number(messageData.fontSize)
      break
    case 'UPDATE_TIMER':
      // keep old UPDATE_TIMER trigger
      break
    case 'TOGGLE_PROJECTION_CONTENT':
      projectionStore.setShowingDefault(messageData.showDefault as boolean)
      break
  }
}

onMounted(() => {
  setupMessageHandler(handleMessage)
  requestCurrentState()
  document.documentElement.style.overflow = 'hidden'
})

onBeforeUnmount(() => {
  if (isElectron()) {
    removeAllListeners('projection-message')
  }
  document.documentElement.style.overflow = ''
})
</script>

<style scoped></style>
