<template>
  <v-row v-if="timerMode === TimerMode.BOTH" class="fill-height ma-0 pa-0">
    <v-col cols="5 pa-0 d-flex align-center justify-center">
      <CountdownTimer
        :progress="timerProgress"
        :timer-formatted-time="timerFormattedTime"
        :size="circleSize"
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
      />
      <ClockDisplay v-else :timezone="selectedTimezone" :size="clockSize" />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import CountdownTimer from '@/components/Timer/CountdownTimer.vue'
import ClockDisplay from '@/components/Timer/ClockDisplay.vue'
import { TimerMode } from '@/types/common'

interface Props {
  timerMode: TimerMode
  timerFormattedTime: string
  selectedTimezone: string
  timerProgress: number
}

const props = defineProps<Props>()

// 響應式視窗尺寸
const windowSize = ref({
  width: window.innerWidth,
  height: window.innerHeight,
})

// 監聽視窗大小變化
const handleResize = () => {
  windowSize.value = {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

// Calculate the circle size based on the timerMode
const circleSize = computed(() => {
  const screenWidth = windowSize.value.width
  if (props.timerMode === TimerMode.BOTH) {
    return 700 * (screenWidth / 1920)
  }
  return 1100 * (screenWidth / 1920)
})

const clockSize = computed(() => {
  const screenWidth = windowSize.value.width
  if (props.timerMode === TimerMode.BOTH) {
    return 260 * (screenWidth / 1920)
  }

  return 400 * (screenWidth / 1920)
})
</script>

<style scoped>
.split-divider {
  width: 8px;
  height: 100vh;
  background: var(--timer-split-divider-color);
  position: absolute;
  left: 41.6%;
  top: 0;
  z-index: 10;
}
</style>
