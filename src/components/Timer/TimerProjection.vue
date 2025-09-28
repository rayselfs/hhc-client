<template>
  <div class="projection-content timer-projection">
    <!-- 單一模式顯示 -->
    <div v-if="timerMode === 'timer'" class="single-mode timer-only">
      <div class="timer-display">
        <CountdownTimer
          :progress="timerProgress"
          :timer-formatted-time="timerFormattedTime"
          :size="circleSize"
        />
      </div>
    </div>

    <div v-else-if="timerMode === 'clock'" class="single-mode clock-only">
      <div class="clock-display">
        <div class="clock-text">
          {{ clockFormattedTime }}
        </div>
      </div>
    </div>

    <!-- 同時顯示模式 -->
    <div v-else-if="timerMode === 'both'" class="split-mode">
      <div class="split-container">
        <div class="split-pane timer-pane" style="width: 40%">
          <div class="timer-display">
            <CountdownTimer
              :progress="timerProgress"
              :timer-formatted-time="timerFormattedTime"
              :size="circleSize"
            />
          </div>
        </div>

        <div class="split-divider"></div>
        <div class="split-pane clock-pane" style="width: 60%">
          <div class="clock-display split-mode-clock">
            <div class="clock-text">
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
import CountdownTimer from './CountdownTimer.vue'

interface Props {
  timerMode: 'timer' | 'clock' | 'both'
  timerFormattedTime: string
  clockFormattedTime: string
  selectedTimezone: string
  timerProgress: number
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
      return 1050 // 1920x1080 或更高
    }
  }
  return 600 // 默認大小（clock 模式）
})
</script>

<style scoped>
.timer-projection {
  font-family: 'Open Sans Variable';
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

.clock-text {
  font-size: 400px;
  font-weight: 600;
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

.split-divider {
  width: 8px;
  height: 100vh;
  background: var(--timer-split-divider-color);
  position: absolute;
  left: 40%;
  top: 0;
  z-index: 10;
}

.split-mode .clock-text {
  font-size: 256px;
}
</style>
