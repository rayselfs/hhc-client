<template>
  <div class="floating-timer" @click="$emit('click')">
    <v-card class="timer-card" elevation="8" :class="{ 'pulse-animation': timerStore.isRunning }">
      <v-card-text class="pa-3">
        <CountdownTimer
          :progress="timerStore.progress"
          :timer-formatted-time="timerStore.formattedTime"
          :size="80"
        >
        </CountdownTimer>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import CountdownTimer from './CountdownTimer.vue'
import { useTimerStore } from '@/stores/timer'

const timerStore = useTimerStore()

defineEmits<{
  (e: 'click'): void
}>()
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
  min-width: 120px;
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
