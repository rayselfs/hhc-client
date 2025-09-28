<template>
  <div class="projection-content timer-projection">
    <!-- Single mode display -->
    <div v-if="timerMode === TimerMode.TIMER" class="single-mode timer-only">
      <div class="timer-display">
        <CountdownTimer
          :progress="timerProgress"
          :timer-formatted-time="timerFormattedTime"
          :size="circleSize"
        />
      </div>
    </div>

    <div v-else-if="timerMode === TimerMode.CLOCK" class="single-mode clock-only">
      <div class="clock-display">
        <div class="clock-text">
          {{ clockFormattedTime }}
        </div>
      </div>
    </div>

    <!-- Split mode display -->
    <div v-else-if="timerMode === TimerMode.BOTH" class="split-mode">
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
import { TimerMode } from '@/types/common'

interface Props {
  timerMode: TimerMode
  timerFormattedTime: string
  clockFormattedTime: string
  selectedTimezone: string
  timerProgress: number
}

const props = defineProps<Props>()

// Calculate the circle size based on the timerMode
const circleSize = computed(() => {
  if (props.timerMode === TimerMode.BOTH) {
    // In split mode, dynamically adjust the size based on the screen height
    const screenHeight = window.innerHeight
    if (screenHeight <= 768) {
      return 450 // 1366x768
    } else if (screenHeight <= 900) {
      return 550 // 1600x900
    } else {
      return 650 // 1920x1080
    }
  } else if (props.timerMode === TimerMode.TIMER) {
    // Pure timer mode, use a larger size
    const screenHeight = window.innerHeight
    if (screenHeight <= 768) {
      return 600 // 1366x768
    } else if (screenHeight <= 900) {
      return 750 // 1600x900
    } else {
      return 1050 // 1920x1080
    }
  }
  return 600
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
