<template>
  <div class="countdown-timer-container">
    <div class="timer-circle">
      <div
        class="progress-ring-container"
        :style="{ width: circleSize + 'px', height: circleSize + 'px' }"
      >
        <v-progress-circular
          :size="circleSize"
          :width="strokeWidth"
          :model-value="invertedProgress"
          color="blue-lighten-3"
          class="progress-ring"
          :bg-color="backgroundColor"
        />
      </div>
      <div class="timer-text" :class="{ 'split-mode': timerMode === 'both' }">
        {{ timerFormattedTime }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  progress: number
  timerMode: 'timer' | 'clock' | 'both'
  timerFormattedTime: string
}

const props = defineProps<Props>()

// 根據 timerMode 計算圓圈大小
const circleSize = computed(() => {
  if (props.timerMode === 'both') {
    // 在分割模式下，根據螢幕高度動態調整大小
    const screenHeight = window.innerHeight
    if (screenHeight <= 768) {
      return 450 // 1366x768
    } else if (screenHeight <= 900) {
      return 550 // 1600x900
    } else {
      return 650 // 1920x1080 或更高
    }
  } else if (props.timerMode === 'timer') {
    // 純計時模式，使用更大的尺寸
    const screenHeight = window.innerHeight
    if (screenHeight <= 768) {
      return 600 // 1366x768
    } else if (screenHeight <= 900) {
      return 750 // 1600x900
    } else {
      return 1000 // 1920x1080 或更高
    }
  }
  return 600 // 默認大小（clock 模式）
})

// 根據 timerMode 計算線條寬度
const strokeWidth = computed(() => {
  if (props.timerMode === 'both') {
    // 在分割模式下，使用固定線條寬度
    return 18
  } else if (props.timerMode === 'timer') {
    // 純計時模式，使用更粗的線條
    return 26
  }
  return 18 // 默認線條寬度（clock 模式）
})

// 倒數進度：從 100% 到 0%
const invertedProgress = computed(() => {
  return 100 - props.progress
})

const backgroundColor = computed(() => {
  return 'var(--timer-progress-ring-bg)'
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
  position: absolute;
  font-size: 20rem;
  font-weight: 600;
  color: var(--projection-text-color);
}

/* 分割模式下的時間文字樣式 */
.timer-text.split-mode {
  font-size: 13rem;
}

/* 1600x900 解析度 */
@media (max-width: 1600px) and (max-height: 900px) {
  .timer-text {
    font-size: 15rem;
  }

  .timer-text.split-mode {
    font-size: 11rem;
  }
}

/* 1366x768 解析度 */
@media (max-width: 1366px) and (max-height: 768px) {
  .timer-text {
    font-size: 12rem;
  }

  .timer-text.split-mode {
    font-size: 9rem;
  }
}
</style>
