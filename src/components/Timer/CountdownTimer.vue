<template>
  <div class="timer-display" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :viewBox="`0 0 ${size} ${size}`">
      <circle
        class="progress-ring-bg"
        :cx="center"
        :cy="center"
        :r="radius"
        :stroke-width="strokeWidth"
        fill="transparent"
      />
      <circle
        class="progress-ring-fg"
        :class="{ 'no-transition': !shouldTransition }"
        :cx="center"
        :cy="center"
        :r="radius"
        :stroke-width="strokeWidth"
        fill="transparent"
        :style="{
          strokeDasharray: `${circumference} ${circumference}`,
          strokeDashoffset: strokeDashoffset,
        }"
      />
    </svg>
    <div class="time-left" :style="{ fontSize }">
      {{ timerFormattedTime }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface Props {
  progress: number
  timerFormattedTime: string
  size: number
}

const props = defineProps<Props>()

// Track whether to apply transition (disable on reset)
const shouldTransition = ref(true)

// Watch for progress changes to detect reset
watch(
  () => props.progress,
  (newProgress, oldProgress) => {
    // If progress suddenly decreases (reset), disable transition temporarily
    if (oldProgress !== undefined && newProgress < oldProgress) {
      shouldTransition.value = false
      // Re-enable transition after a brief delay
      setTimeout(() => {
        shouldTransition.value = true
      }, 50)
    }
  },
)

// Calculate center point
const center = computed(() => props.size / 2)

// Calculate the stroke width based on the size
const strokeWidth = computed(() => {
  return Math.round(props.size * 0.018)
})

// Calculate radius (center minus stroke width and some padding)
const radius = computed(() => {
  return center.value - strokeWidth.value - 2
})

// Calculate circumference
const circumference = computed(() => {
  return 2 * Math.PI * radius.value
})

// Calculate stroke dash offset based on progress (inverted: full to empty)
const strokeDashoffset = computed(() => {
  return (props.progress / 100) * circumference.value
})

// Calculate the font size based on the size
const fontSize = computed(() => {
  const ratio = props.size / 1000
  const baseFontSize = 340 // px
  const calculatedFontSize = baseFontSize * ratio

  return `${calculatedFontSize}px`
})
</script>

<style scoped>
.timer-display {
  position: relative;
  margin: 0 auto;
}

.timer-display svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.timer-display .progress-ring-bg {
  stroke: var(--timer-progress-ring-bg);
}

.timer-display .progress-ring-fg {
  stroke: var(--timer-progress-ring-color);
  stroke-linecap: round;
  transition: stroke-dashoffset 1s linear;
}

.timer-display .progress-ring-fg.no-transition {
  transition: none;
}

.time-left {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-weight: 500;
}
</style>
