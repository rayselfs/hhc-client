<template>
  <div class="floating-timer" @click="$emit('click')">
    <v-card class="timer-card" elevation="8" :class="{ 'pulse-animation': isRunning }">
      <v-card-text class="pa-3">
        <CountdownTimer
          :progress="progress"
          :timer-formatted-time="formatTime(remainingTime)"
          :size="80"
        >
        </CountdownTimer>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CountdownTimer from './CountdownTimer.vue'

interface Props {
  remainingTime: number
  isRunning: boolean
  originalDuration?: number
}

const props = withDefaults(defineProps<Props>(), {
  originalDuration: 300,
})

defineEmits<{
  (e: 'click'): void
}>()

// 計算進度百分比
const progress = computed(() => {
  if (!props.originalDuration || props.originalDuration === 0) return 0
  return Math.max(0, (props.remainingTime / props.originalDuration) * 100)
})

// 格式化時間顯示
const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
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
