<template>
  <div class="liquid-progress-ring" :style="{ width: `${size}px`, height: `${size}px` }">
    <!-- SVG Progress Ring -->
    <svg :viewBox="`0 0 ${size} ${size}`" class="liquid-progress-ring__svg">
      <!-- Glow filter definition -->
      <defs>
        <linearGradient :id="`gradient-${uid}`" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" :style="{ stopColor: gradientStart }" />
          <stop offset="100%" :style="{ stopColor: gradientEnd }" />
        </linearGradient>
        <filter :id="`glow-${uid}`" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter :id="`inner-shadow-${uid}`">
          <feOffset dx="0" dy="1" />
          <feGaussianBlur stdDeviation="1" result="offset-blur" />
          <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
          <feFlood flood-color="rgba(0,0,0,0.15)" flood-opacity="1" result="color" />
          <feComposite operator="in" in="color" in2="inverse" result="shadow" />
          <feComposite operator="over" in="shadow" in2="SourceGraphic" />
        </filter>
      </defs>

      <!-- Background ring (glass effect) -->
      <circle
        class="liquid-progress-ring__bg"
        :cx="center"
        :cy="center"
        :r="radius"
        :stroke-width="computedStrokeWidth"
        fill="transparent"
        :filter="`url(#inner-shadow-${uid})`"
      />

      <!-- Progress ring (gradient + glow) -->
      <circle
        class="liquid-progress-ring__fg"
        :class="{ 'liquid-progress-ring__fg--no-transition': !shouldTransition }"
        :cx="center"
        :cy="center"
        :r="radius"
        :stroke-width="computedStrokeWidth"
        fill="transparent"
        :stroke="`url(#gradient-${uid})`"
        :filter="`url(#glow-${uid})`"
        :style="{
          strokeDasharray: `${circumference} ${circumference}`,
          strokeDashoffset: strokeDashoffset,
        }"
      />
    </svg>

    <!-- Content slot (time display) -->
    <div
      class="liquid-progress-ring__content"
      :class="{ 'liquid-progress-ring__content--blinking': isWarning }"
      :style="{ fontSize: computedFontSize }"
    >
      <slot>
        <span v-if="displayText">{{ formattedTime }}</span>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useLiquidGlassFilters } from '../composables/useLiquidGlassFilters'

useLiquidGlassFilters()

// Generate unique ID for SVG filters
const uid = Math.random().toString(36).substring(2, 9)

interface Props {
  /** 進度值 (0-100) */
  progress: number
  /** 格式化的時間字串 */
  formattedTime?: string
  /** 圓環大小 (px) */
  size?: number
  /** 是否顯示時間文字 */
  displayText?: boolean
  /** 是否為警告狀態 (閃爍) */
  isWarning?: boolean
  /** 進度條顏色 (漸層起點) */
  color?: string
  /** 線條粗細比例 (相對於 size) */
  strokeRatio?: number
}

const props = withDefaults(defineProps<Props>(), {
  formattedTime: '',
  size: 250,
  displayText: true,
  isWarning: false,
  color: 'primary',
  strokeRatio: 0.025,
})

// Color mappings
const COLOR_MAP: Record<string, { start: string; end: string }> = {
  primary: { start: 'rgb(99, 160, 255)', end: 'rgb(59, 130, 246)' },
  secondary: { start: 'rgb(169, 132, 255)', end: 'rgb(139, 92, 246)' },
  success: { start: 'rgb(74, 222, 128)', end: 'rgb(34, 197, 94)' },
  error: { start: 'rgb(255, 118, 118)', end: 'rgb(239, 68, 68)' },
  warning: { start: 'rgb(255, 200, 60)', end: 'rgb(245, 158, 11)' },
  info: { start: 'rgb(56, 189, 248)', end: 'rgb(14, 165, 233)' },
}

const gradientStart = computed(() => COLOR_MAP[props.color]?.start || COLOR_MAP.primary!.start)
const gradientEnd = computed(() => COLOR_MAP[props.color]?.end || COLOR_MAP.primary!.end)

// Track whether to apply transition (disable on reset)
const shouldTransition = ref(true)

// Watch for progress changes to detect reset
watch(
  () => props.progress,
  (newProgress, oldProgress) => {
    if (oldProgress !== undefined && newProgress < oldProgress) {
      shouldTransition.value = false
      setTimeout(() => {
        shouldTransition.value = true
      }, 50)
    }
  },
)

// Calculations
const center = computed(() => props.size / 2)
const computedStrokeWidth = computed(() => Math.round(props.size * props.strokeRatio))
const radius = computed(() => center.value - computedStrokeWidth.value / 2 - 4)
const circumference = computed(() => 2 * Math.PI * radius.value)

// Progress goes from full (0% offset) to empty (100% offset)
const strokeDashoffset = computed(() => {
  return (props.progress / 100) * circumference.value
})

// Font size based on ring size
const computedFontSize = computed(() => {
  const ratio = props.size / 1000
  const baseFontSize = 310
  return `${baseFontSize * ratio}px`
})
</script>

<style scoped lang="scss">
.liquid-progress-ring {
  position: relative;
  margin: 0 auto;
}

.liquid-progress-ring__svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.liquid-progress-ring__bg {
  stroke: rgba(255, 255, 255, 0.12);
}

.liquid-progress-ring__fg {
  stroke-linecap: round;
  transition: stroke-dashoffset 1s linear;

  &--no-transition {
    transition: none;
  }
}

.liquid-progress-ring__content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-weight: 500;
  color: rgba(255, 255, 255, 0.95);
  text-align: center;

  &--blinking {
    animation: liquid-blink 1s infinite;
  }
}

@keyframes liquid-blink {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.2;
  }
  100% {
    opacity: 1;
  }
}
</style>
