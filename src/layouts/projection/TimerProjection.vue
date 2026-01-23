<template>
  <!-- Overtime Message Display -->
  <v-row
    v-if="
      timerProjectionStore.settings.overtimeMessageEnabled &&
      timerProjectionStore.isFinished &&
      timerProjectionStore.settings.overtimeMessage
    "
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
        {{ timerProjectionStore.settings.overtimeMessage }}
      </div>
    </v-col>
  </v-row>

  <!-- Normal Timer Layout -->
  <v-row
    v-else-if="timerProjectionStore.settings.mode === TimerMode.BOTH"
    class="fill-height ma-0 pa-0"
  >
    <v-col cols="5 pa-0 d-flex align-center justify-center">
      <liquid-progress-ring
        :progress="timerProjectionStore.progress"
        :formatted-time="timerProjectionStore.formattedTime"
        :size="circleSize"
        :is-warning="timerProjectionStore.isWarning"
      />
    </v-col>
    <div class="split-divider"></div>
    <v-col cols="7 pa-0 d-flex align-center justify-center">
      <ClockDisplay :timezone="timerProjectionStore.settings.timezone" :size="clockSize" />
    </v-col>
  </v-row>
  <v-row v-else class="fill-height ma-0 pa-0 align-center justify-center">
    <v-col cols="12 pa-0 d-flex align-center justify-center">
      <liquid-progress-ring
        v-if="timerProjectionStore.settings.mode === TimerMode.TIMER"
        :progress="timerProjectionStore.progress"
        :formatted-time="timerProjectionStore.formattedTime"
        :size="circleSize"
        :is-warning="timerProjectionStore.isWarning"
      />
      <ClockDisplay v-else :timezone="timerProjectionStore.settings.timezone" :size="clockSize" />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import ClockDisplay from '@/components/Timer/ClockDisplay.vue'
import { TimerMode } from '@/types/common'
import { useWindowSize } from '@/composables/useLayout'
import { useTimerProjectionStore } from '@/stores/timerProjection'

const timerProjectionStore = useTimerProjectionStore()

// 使用統一的視窗尺寸 composable
const { width } = useWindowSize(100)

// Calculate the circle size based on the timerMode
const circleSize = computed(() => {
  const screenWidth = width.value
  if (timerProjectionStore.settings.mode === TimerMode.BOTH) {
    return 700 * (screenWidth / 1920)
  }
  return 1100 * (screenWidth / 1920)
})

const clockSize = computed(() => {
  const screenWidth = width.value
  if (timerProjectionStore.settings.mode === TimerMode.BOTH) {
    return 260 * (screenWidth / 1920)
  }

  return 400 * (screenWidth / 1920)
})

const overtimeFontSize = computed(() => {
  const screenWidth = width.value
  const len = timerProjectionStore.settings.overtimeMessage?.length || 0

  if (len === 0) return 0
  let vw = 12
  if (len <= 4) {
    vw = 18
  } else if (len > 12) {
    vw = 10
  }

  return screenWidth * (vw / 100)
})

onMounted(() => {
  timerProjectionStore.initialize()
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
