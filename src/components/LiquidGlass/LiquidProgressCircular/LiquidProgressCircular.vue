<template>
  <svg
    class="liquid-progress-circular"
    :class="{ 'liquid-progress-circular--indeterminate': indeterminate }"
    :style="svgStyle"
    :viewBox="`0 0 ${viewBoxSize} ${viewBoxSize}`"
    role="progressbar"
    :aria-valuenow="indeterminate ? undefined : modelValue"
    :aria-valuemin="indeterminate ? undefined : 0"
    :aria-valuemax="indeterminate ? undefined : 100"
    :aria-busy="indeterminate ? 'true' : undefined"
  >
    <!-- Background track -->
    <circle
      class="liquid-progress-circular__track"
      :cx="center"
      :cy="center"
      :r="radius"
      :stroke-width="width"
      fill="transparent"
    />
    <!-- Progress arc -->
    <circle
      class="liquid-progress-circular__progress"
      :cx="center"
      :cy="center"
      :r="radius"
      :stroke-width="width"
      fill="transparent"
      :style="progressStyle"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  /** Size in pixels */
  size?: number
  /** Stroke width in pixels */
  width?: number
  /** Progress value (0-100), ignored when indeterminate */
  modelValue?: number
  /** Indeterminate mode (continuous spinning) */
  indeterminate?: boolean
  /** Color (CSS color or theme color name) */
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 24,
  width: 2,
  modelValue: 0,
  indeterminate: false,
})

// SVG calculations
const viewBoxSize = 44
const center = viewBoxSize / 2
const radius = computed(() => (viewBoxSize - props.width * 2) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)

const svgStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}))

const progressStyle = computed(() => {
  const color = props.color || 'currentColor'

  if (props.indeterminate) {
    return {
      stroke: color,
      strokeDasharray: `${circumference.value * 0.25} ${circumference.value * 0.75}`,
    }
  }

  const progress = Math.max(0, Math.min(100, props.modelValue))
  const offset = circumference.value * (1 - progress / 100)

  return {
    stroke: color,
    strokeDasharray: `${circumference.value}`,
    strokeDashoffset: `${offset}`,
  }
})
</script>

<style lang="scss" scoped>
.liquid-progress-circular {
  transform: rotate(-90deg);
  flex-shrink: 0;

  &__track {
    stroke: rgba(var(--hhc-glass-text), 0.1);
  }

  &__progress {
    stroke-linecap: round;
    transition:
      stroke-dashoffset 0.3s ease,
      stroke 0.3s ease;
  }

  &--indeterminate {
    animation: liquid-progress-rotate 1.4s linear infinite;

    .liquid-progress-circular__progress {
      animation: liquid-progress-dash 1.4s ease-in-out infinite;
      transition: none;
    }
  }
}

@keyframes liquid-progress-rotate {
  100% {
    transform: rotate(270deg);
  }
}

@keyframes liquid-progress-dash {
  0% {
    stroke-dasharray: 1, 200;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 100, 200;
    stroke-dashoffset: -15;
  }
  100% {
    stroke-dasharray: 100, 200;
    stroke-dashoffset: -125;
  }
}
</style>
