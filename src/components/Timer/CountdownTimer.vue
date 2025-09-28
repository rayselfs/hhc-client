<template>
  <div class="countdown-timer-container">
    <div class="timer-circle">
      <div class="progress-ring-container" :style="{ width: size + 'px', height: size + 'px' }">
        <v-progress-circular
          :size="size"
          :width="strokeWidth"
          :model-value="invertedProgress"
          color="blue-lighten-3"
          class="progress-ring"
          :bg-color="backgroundColor"
        >
          <span class="timer-text" :style="{ fontSize }">{{ timerFormattedTime }}</span>
        </v-progress-circular>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  progress: number
  timerFormattedTime: string
  size: number
}

const props = defineProps<Props>()

// Calculate the stroke width based on the size
const strokeWidth = computed(() => {
  return Math.round(props.size * 0.026)
})

// Inverted progress: from 100% to 0%
const invertedProgress = computed(() => {
  return 100 - props.progress
})

const backgroundColor = computed(() => {
  return 'var(--timer-progress-ring-bg)'
})

// Calculate the font size based on the size
const fontSize = computed(() => {
  const ratio = props.size / 1000
  const baseFontSize = 320 // px
  const calculatedFontSize = baseFontSize * ratio

  return `${calculatedFontSize}px`
})
</script>

<style scoped>
.countdown-timer-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Timer circle */
.timer-circle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-ring-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.timer-text {
  font-weight: 600;
  color: var(--projection-text-color);
}
</style>
