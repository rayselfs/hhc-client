<template>
  <div class="countdown-timer-container">
    <div class="timer-circle">
      <div class="progress-ring-container" :style="{ width: size + 'px', height: size + 'px' }">
        <v-progress-circular
          :size="size"
          :width="strokeWidth"
          :model-value="invertedProgress"
          color="blue-lighten-3"
          class="progress-ring"
          :bg-color="backgroundColor"
        >
          <span class="timer-text" :style="{ fontSize }">{{ timerFormattedTime }}</span>
        </v-progress-circular>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  progress: number
  timerFormattedTime: string
  size: number
}

const props = defineProps<Props>()

// 根據 size 計算線條寬度
const strokeWidth = computed(() => {
  // 基於 size 計算線條寬度，保持比例
  return Math.round(props.size * 0.026) // 約為 size 的 2.6%
})

// 倒數進度：從 100% 到 0%
const invertedProgress = computed(() => {
  return 100 - props.progress
})

const backgroundColor = computed(() => {
  return 'var(--timer-progress-ring-bg)'
})

// 根據 size 計算字體大小
const fontSize = computed(() => {
  // 基於 size 計算字體大小
  // 當 size = 1000 時，fontSize = 320px
  // 當 size = 650 時，fontSize = 208px
  // 使用線性插值計算
  const ratio = props.size / 1000
  const baseFontSize = 320 // px
  const calculatedFontSize = baseFontSize * ratio

  return `${calculatedFontSize}px`
})
</script>

<style scoped>
.countdown-timer-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 計時器圓圈 */
.timer-circle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-ring-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.timer-text {
  font-weight: 600;
  color: var(--projection-text-color);
}

/* 分割模式下的時間文字樣式 */
/* .timer-text.split-mode {
  font-size: 208px;
} */

/* 1600x900 解析度 */
/* @media (max-width: 1600px) and (max-height: 900px) {
  .timer-text {
    font-size: 15rem;
  }

  .timer-text.split-mode {
    font-size: 11rem;
  }
} */

/* 1366x768 解析度 */
/* @media (max-width: 1366px) and (max-height: 768px) {
  .timer-text {
    font-size: 12rem;
  }

  .timer-text.split-mode {
    font-size: 9rem;
  }
} */
</style>
