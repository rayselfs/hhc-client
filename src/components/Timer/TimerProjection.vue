<template>
  <div class="projection-content timer-projection">
    <!-- 單一模式顯示 -->
    <div v-if="timerMode === 'timer'" class="single-mode timer-only">
      <div class="timer-display">
        <div class="timer-circle">
          <svg class="progress-ring" :width="circleSize" :height="circleSize">
            <circle
              class="progress-ring-circle-bg"
              :stroke-width="strokeWidth"
              fill="transparent"
              :r="normalizedRadius"
              :cx="circleSize / 2"
              :cy="circleSize / 2"
            />
            <circle
              class="progress-ring-circle"
              :class="{ 'near-end': isNearEnd }"
              :stroke-width="strokeWidth"
              fill="transparent"
              :r="normalizedRadius"
              :cx="circleSize / 2"
              :cy="circleSize / 2"
              :stroke-dasharray="circumference + ' ' + circumference"
              :style="{ strokeDashoffset: strokeDashoffset }"
            />
          </svg>
          <div class="timer-text" :style="{ fontSize: timerTextSize + 'rem' }">
            {{ timerFormattedTime }}
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="timerMode === 'clock'" class="single-mode clock-only">
      <div class="clock-display">
        <div
          class="time-text"
          :style="{
            fontSize: clockTextSize + 'rem',
            letterSpacing: clockTextSize * 0.5 + 'px',
          }"
        >
          {{ clockFormattedTime }}
        </div>
      </div>
    </div>

    <!-- 同時顯示模式 -->
    <div v-else-if="timerMode === 'both'" class="split-mode">
      <div class="split-container">
        <div class="split-pane timer-pane" style="width: 40%">
          <div class="timer-display">
            <div class="timer-circle">
              <svg class="progress-ring" :width="circleSize" :height="circleSize">
                <circle
                  class="progress-ring-circle-bg"
                  :stroke-width="strokeWidth"
                  fill="transparent"
                  :r="normalizedRadius"
                  :cx="circleSize / 2"
                  :cy="circleSize / 2"
                />
                <circle
                  class="progress-ring-circle"
                  :class="{ 'near-end': isNearEnd }"
                  :stroke-width="strokeWidth"
                  fill="transparent"
                  :r="normalizedRadius"
                  :cx="circleSize / 2"
                  :cy="circleSize / 2"
                  :stroke-dasharray="circumference + ' ' + circumference"
                  :style="{ strokeDashoffset: strokeDashoffset }"
                />
              </svg>
              <div class="timer-text" :style="{ fontSize: timerTextSize + 'rem' }">
                {{ timerFormattedTime }}
              </div>
            </div>
          </div>
        </div>

        <div class="split-divider"></div>
        <div class="split-pane clock-pane" style="width: 60%">
          <div class="clock-display split-mode-clock">
            <div
              class="time-text split-mode-time"
              :style="{
                fontSize: clockTextSize + 'rem',
                letterSpacing: clockTextSize * 0.5 + 'px',
              }"
            >
              {{ clockFormattedTime }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  timerMode: 'timer' | 'clock' | 'both'
  timerFormattedTime: string
  clockFormattedTime: string
  selectedTimezone: string
  timerProgress: number
}

const props = defineProps<Props>()

// 圓圈進度條相關
const circleSize = computed(() => {
  if (props.timerMode === 'both') {
    // 在分割模式下，根據螢幕高度動態調整大小
    const screenHeight = window.innerHeight
    if (screenHeight <= 768) {
      return 450 // 1366x768
    } else if (screenHeight <= 900) {
      return 550 // 1600x900
    } else {
      return 700 // 1920x1080 或更高
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

const strokeWidth = computed(() => {
  if (props.timerMode === 'both') {
    // 在分割模式下，使用固定線條寬度
    return 18
  } else if (props.timerMode === 'timer') {
    // 純計時模式，使用更粗的線條
    return 22
  }
  return 18 // 默認線條寬度（clock 模式）
})

const normalizedRadius = computed(() => {
  const radius = circleSize.value / 2 - strokeWidth.value * 2
  // 確保半徑不會是負值或過小，並且有合理的比例
  const minRadius = Math.max(10, circleSize.value * 0.15)
  return Math.max(minRadius, radius)
})

const circumference = computed(() => normalizedRadius.value * 2 * Math.PI)

const strokeDashoffset = computed(() => {
  const progress = props.timerProgress / 100
  // 從滿版開始，隨著進度增加而減少（消失）
  return progress * circumference.value
})

// 計時器文字大小計算
const timerTextSize = computed(() => {
  if (props.timerMode === 'both') {
    // 在分割模式下，根據螢幕高度動態調整文字大小
    const screenHeight = window.innerHeight
    if (screenHeight <= 768) {
      return 7 // 1366x768
    } else if (screenHeight <= 900) {
      return 9 // 1600x900
    } else {
      return 13 // 1920x1080 或更高
    }
  } else if (props.timerMode === 'timer') {
    // 純計時模式，使用更大的文字
    const screenHeight = window.innerHeight
    if (screenHeight <= 768) {
      return 10 // 1366x768
    } else if (screenHeight <= 900) {
      return 12 // 1600x900
    } else {
      return 18 // 1920x1080 或更高
    }
  }
  return 6 // 默認大小（clock 模式）
})

// 時鐘文字大小計算
const clockTextSize = computed(() => {
  if (props.timerMode === 'both') {
    // 在分割模式下，根據螢幕高度動態調整文字大小
    const screenHeight = window.innerHeight
    if (screenHeight <= 768) {
      return 6 // 1366x768
    } else if (screenHeight <= 900) {
      return 8 // 1600x900
    } else {
      return 10 // 1920x1080 或更高
    }
  }
  return 16 // 單一模式使用12rem
})

// 時區文字大小計算已移除

// 判斷是否接近計時結束
const isNearEnd = computed(() => {
  return props.timerProgress >= 90
})
</script>

<style scoped>
.timer-projection {
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.timer-projection::-webkit-scrollbar {
  display: none;
}

/* 單一模式 */
.single-mode {
  height: 100vh;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  position: fixed;
  top: 0;
  left: 0;
}

.timer-display,
.clock-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

/* 計時器圓圈 */
.timer-circle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-ring {
  transform: rotate(-90deg);
  transition: all 0.1s ease-out;
}

.progress-ring-circle-bg {
  stroke: var(--timer-progress-ring-bg);
}

.progress-ring-circle {
  stroke: var(--timer-progress-ring-color);
  stroke-linecap: round;
  transition:
    stroke-dashoffset 0.5s ease-in-out,
    stroke-width 0.1s ease-out;
}

/* 接近結束時的樣式 */
.progress-ring-circle.near-end {
  stroke: var(--timer-progress-ring-color);
  filter: drop-shadow(0 0 12px rgba(44, 90, 160, 0.8));
  animation: pulse 1s ease-in-out infinite alternate;
}

@keyframes pulse {
  from {
    filter: drop-shadow(0 0 12px rgba(44, 90, 160, 0.8));
  }
  to {
    filter: drop-shadow(0 0 20px rgba(44, 90, 160, 1));
  }
}

.timer-text {
  position: absolute;
  font-size: 4rem;
  font-weight: 700;
  text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.5);
  color: white;
}

/* 時鐘顯示 */
.time-text {
  font-family: 'Digital Numbers Regular', monospace;
  font-size: 12rem;
  font-weight: 700;
  letter-spacing: 12px;
  text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.5);
  margin-bottom: 1rem;
}

/* 分割模式 */
.split-mode {
  height: 100vh;
  width: 100vw;
  position: fixed;
  top: 0;
  left: 0;
}

.split-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  position: relative;
}

.split-pane {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: width 0.1s ease;
}

/* 分割線樣式 */
.split-divider {
  width: 8px;
  height: 100vh;
  background: var(--timer-split-divider-color);
  position: absolute;
  left: 40%;
  top: 0;
  z-index: 10;
}

/* 響應式設計 - 針對不同解析度優化 */

/* 1366x768 解析度 */
@media (max-width: 1366px) and (max-height: 768px) {
  .time-text {
    font-size: 8rem;
    letter-spacing: 8px;
  }

  /* 時區文字樣式已移除 */

  .timer-text {
    font-size: 3.5rem;
  }
}

/* 1600x900 解析度 */
@media (max-width: 1600px) and (max-height: 900px) {
  .time-text {
    font-size: 10rem;
    letter-spacing: 10px;
  }

  /* 時區文字樣式已移除 */

  .timer-text {
    font-size: 4rem;
  }
}

/* 1920x1080 解析度 - 預設大小，無需額外調整 */

/* 小螢幕響應式 */
@media (max-width: 768px) {
  .time-text {
    font-size: 5rem;
    letter-spacing: 4px;
  }

  /* 時區文字樣式已移除 */

  .timer-text {
    font-size: 2.5rem;
  }

  .circleSize {
    width: 300px;
    height: 300px;
  }

  .split-container {
    flex-direction: column;
  }

  .split-pane {
    width: 100% !important;
    height: 50%;
  }
}
</style>
