<template>
  <v-fade-transition mode="out-in">
    <div
      v-if="!stopwatchStore.global.isStopwatchMode"
      key="timer"
      class="d-flex flex-column align-center justify-center fill-height"
    >
      <liquid-timer-ring
        :progress="timerStore.progress"
        :formatted-time="timerStore.formattedTime"
        :size="size"
        :display-text="timerStore.isRunning"
        class="mb-8"
      >
        <template #default>
          <div v-if="timerStore.state === 'stopped'" class="d-flex justify-center align-center">
            <TimeInput
              v-model="timerStore.inputMinutes"
              :on-error="(msg) => showSnackBar(msg, { color: 'error', timeout: 3000 })"
            />
            <span class="time-separator">:</span>
            <TimeInput
              v-model="timerStore.inputSeconds"
              :on-error="(msg) => showSnackBar(msg, { color: 'error', timeout: 3000 })"
            />
          </div>
          <span v-else>{{ timerStore.formattedTime }}</span>
        </template>
      </liquid-timer-ring>

      <!-- Remove Time Buttons -->
      <TimeAdjustmentButtons
        type="remove"
        :remaining-time="timerStore.settings.remainingTime"
        @adjust="removeTime"
      />

      <!-- Add Time Buttons -->
      <TimeAdjustmentButtons
        type="add"
        :remaining-time="timerStore.settings.remainingTime"
        :is-finished="timerStore.isFinished"
        @adjust="addTime"
      />
    </div>
    <div v-else key="stopwatch" class="d-flex justify-center align-center fill-height">
      <Stopwatch :size="size" />
    </div>
  </v-fade-transition>
</template>

<script setup lang="ts">
import { useTimerStore } from '@/stores/timer'
import { useStopwatchStore } from '@/stores/stopwatch'
import { useSnackBar } from '@/composables/useSnackBar'
import Stopwatch from '@/components/Timer/StopWatcher.vue'
import TimeAdjustmentButtons from '@/components/Timer/TimeAdjustmentButtons.vue'
import TimeInput from '@/components/Timer/TimeInput.vue'

interface Props {
  size?: number
}

withDefaults(defineProps<Props>(), {
  size: 250,
})

const timerStore = useTimerStore()
const stopwatchStore = useStopwatchStore()
const { showSnackBar } = useSnackBar()

const addTime = (secondsToAdd: number) => {
  timerStore.addTime(secondsToAdd)
}

const removeTime = (secondsToRemove: number) => {
  timerStore.removeTime(secondsToRemove)
}
</script>

<style scoped>
.time-separator {
  font-size: 77px;
  font-weight: 500;
}
</style>
