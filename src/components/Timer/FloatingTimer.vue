<template>
  <div class="floating-timer" @click="handleClick" v-if="isVisible">
    <v-card
      class="timer-card pa-1"
      elevation="8"
      :class="{ 'pulse-animation': timerStore.isRunning }"
    >
      <v-card-text class="pa-3" v-if="!stopwatchStore.global.isStopwatchMode">
        <CountdownTimer
          :progress="timerStore.progress"
          :timer-formatted-time="timerStore.formattedTime"
          :size="90"
        >
        </CountdownTimer>
      </v-card-text>
      <v-card-text class="pa-3 d-flex justify-center align-center" v-else>
        <Stopwatch :size="80" />
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CountdownTimer from './CountdownTimer.vue'
import Stopwatch from './StopWatcher.vue'
import { useTimerStore } from '@/stores/timer'
import { useStopwatchStore } from '@/stores/stopwatch'

import { useProjectionMessaging } from '@/composables/useProjectionMessaging'
import { useProjectionStore } from '@/stores/projection'
import { ViewType } from '@/types/common'

const timerStore = useTimerStore()
const stopwatchStore = useStopwatchStore()
const projectionStore = useProjectionStore()
const { setProjectionState } = useProjectionMessaging()

const isVisible = computed(() => {
  return timerStore.isActivityRunning && projectionStore.currentView !== ViewType.TIMER
})

const handleClick = () => {
  setProjectionState(true, ViewType.TIMER)
}
</script>

<style scoped>
.floating-timer {
  position: fixed;
  bottom: 20px;
  right: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.floating-timer:hover {
  transform: scale(1.05);
}

.timer-card {
  min-width: 90px;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.timer-card:hover {
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

/* 脈衝動畫 */
.pulse-animation {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(var(--v-theme-primary), 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(var(--v-theme-primary), 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(var(--v-theme-primary), 0);
  }
}

/* 響應式設計 */
@media (max-width: 768px) {
  .floating-timer {
    bottom: 15px;
    right: 15px;
  }

  .timer-card {
    min-width: 100px;
  }
}
</style>
