<template>
  <div class="projection-content timer-projection">
    <!-- 單一模式顯示 -->
    <div v-if="timerMode === 'timer'" class="single-mode timer-only">
      <div class="timer-display">
        <CountdownTimer
          :progress="timerProgress"
          :timer-mode="timerMode"
          :timer-formatted-time="timerFormattedTime"
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
              :timer-mode="timerMode"
              :timer-formatted-time="timerFormattedTime"
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
  font-size: 25rem;
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
  font-size: 16rem;
}
</style>
