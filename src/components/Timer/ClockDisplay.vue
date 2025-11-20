<template>
  <div class="clock-text" :style="{ fontSize: `${props.size}px` }">
    {{ clockFormattedTime }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTimerStore } from '@/stores/timer'

interface Props {
  timezone: string
  size: number
}

const props = defineProps<Props>()
const timerStore = useTimerStore()

const clockFormattedTime = computed(() => {
  const time = timerStore.settings.currentTime || new Date()
  return time.toLocaleTimeString('en-US', {
    timeZone: props.timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
})
</script>

<style scoped>
.clock-text {
  font-weight: 600;
}
</style>
