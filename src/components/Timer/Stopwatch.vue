<template>
  <div class="stopwatch-container">
    <!-- Stopwatch Display -->
    <v-row>
      <v-col cols="12" align="center" class="pb-0">
        <div class="stopwatch-time">{{ stopwatchTime }}</div>
      </v-col>
      <v-col cols="6" class="d-flex justify-end">
        <v-btn
          v-if="!isStopwatchRunning"
          icon="mdi-play"
          color="primary"
          variant="flat"
          @click="startStopwatch"
        ></v-btn>
        <v-btn
          v-else
          icon="mdi-pause"
          color="warning"
          variant="flat"
          @click="pauseStopwatch"
        ></v-btn>
      </v-col>
      <v-col cols="6" class="d-flex justify-start">
        <v-btn
          icon="mdi-refresh"
          color="grey"
          variant="outlined"
          :disabled="!isStopwatchRunning && stopwatchTime === '00:00'"
          @click="resetStopwatch"
        ></v-btn>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTimerStore } from '@/stores/timer'

const timerStore = useTimerStore()

// 碼錶相關方法
const startStopwatch = () => {
  timerStore.startStopwatch()
}

const pauseStopwatch = () => {
  timerStore.pauseStopwatch()
}

const resetStopwatch = () => {
  timerStore.resetStopwatch()
}

// 碼錶時間顯示
const stopwatchTime = computed(() => timerStore.getStopwatchTime())
const isStopwatchRunning = computed(() => timerStore.stopwatchSettings.isRunning)
</script>

<style scoped>
.stopwatch-container {
  width: 100%;
}

.stopwatch-time {
  font-size: 60px;
  font-weight: 500;
}
</style>
