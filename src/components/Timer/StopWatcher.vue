<template>
  <div
    class="d-flex justify-center align-center"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <span class="stopwatch-text" :style="{ fontSize: fontSize }">{{
      stopwatchStore.formattedTime
    }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStopwatchStore } from '@/stores/stopwatch'

interface Props {
  size?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 300,
})

const stopwatchStore = useStopwatchStore()

const fontSize = computed(() => {
  const ratio = props.size / 150
  const baseFontSize = 60
  return `${Math.round(baseFontSize * ratio)}px`
})
</script>

<style scoped>
.stopwatch-text {
  font-weight: 600;
}
</style>
