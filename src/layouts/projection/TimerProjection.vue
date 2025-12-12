<template>
  <!-- Overtime Message Display -->
  <v-row
    v-if="overtimeMessageEnabled && isFinished && overtimeMessage"
    class="fill-height ma-0 pa-0 align-center justify-center"
  >
    <v-col cols="12" class="d-flex justify-center align-center">
      <div
        class="text-center text-pre-wrap text-break"
        :style="{
          fontSize: `${overtimeFontSize}px`,
          lineHeight: 1.2,
          fontWeight: 'bold',
        }"
      >
        {{ overtimeMessage }}
      </div>
    </v-col>
  </v-row>

  <!-- Normal Timer Layout -->
  <v-row v-else-if="timerMode === TimerMode.BOTH" class="fill-height ma-0 pa-0">
    <v-col cols="5 pa-0 d-flex align-center justify-center">
      <CountdownTimer
        :progress="timerProgress"
        :timer-formatted-time="timerFormattedTime"
        :size="circleSize"
        :is-warning="isWarning"
      />
    </v-col>
    <div class="split-divider"></div>
    <v-col cols="7 pa-0 d-flex align-center justify-center">
      <ClockDisplay :timezone="selectedTimezone" :size="clockSize" />
    </v-col>
  </v-row>
  <v-row v-else class="fill-height ma-0 pa-0 align-center justify-center">
    <v-col cols="12 pa-0 d-flex align-center justify-center">
      <CountdownTimer
        v-if="timerMode === TimerMode.TIMER"
        :progress="timerProgress"
        :timer-formatted-time="timerFormattedTime"
        :size="circleSize"
        :is-warning="isWarning"
      />
      <ClockDisplay v-else :timezone="selectedTimezone" :size="clockSize" />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CountdownTimer from '@/components/Timer/CountdownTimer.vue'
import ClockDisplay from '@/components/Timer/ClockDisplay.vue'
import { TimerMode } from '@/types/common'
import { useWindowSize } from '@/composables/useLayout'

interface Props {
  timerMode: TimerMode
  timerFormattedTime: string
  selectedTimezone: string
  timerProgress: number
  isWarning?: boolean
  isFinished?: boolean
  overtimeMessageEnabled?: boolean
  overtimeMessage?: string
}

const props = defineProps<Props>()

// 使用統一的視窗尺寸 composable
const { width } = useWindowSize(100)

// Calculate the circle size based on the timerMode
const circleSize = computed(() => {
  const screenWidth = width.value
  if (props.timerMode === TimerMode.BOTH) {
    return 700 * (screenWidth / 1920)
  }
  return 1100 * (screenWidth / 1920)
})

const clockSize = computed(() => {
  const screenWidth = width.value
  if (props.timerMode === TimerMode.BOTH) {
    return 260 * (screenWidth / 1920)
  }

  return 400 * (screenWidth / 1920)
})

const overtimeFontSize = computed(() => {
  const screenWidth = width.value
  const len = props.overtimeMessage?.length || 0

  if (len === 0) return 0
  let vw = 12
  if (len <= 4) {
    vw = 18
  } else if (len > 12) {
    vw = 10
  }

  return screenWidth * (vw / 100)
})
</script>

<style scoped>
.split-divider {
  width: 6px;
  height: 100vh;
  background: var(--timer-split-divider-color);
  position: absolute;
  left: 41.6%;
  top: 0;
  z-index: 10;
}
</style>
