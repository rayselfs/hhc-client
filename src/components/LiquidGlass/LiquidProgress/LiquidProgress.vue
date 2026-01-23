<template>
  <div
    class="liquid-progress position-relative"
    :class="[computedRounded, { 'liquid-progress--indeterminate': indeterminate }]"
    :style="containerStyle"
  >
    <!-- Glass background -->
    <div class="liquid-progress__bg" :class="computedRounded"></div>

    <!-- Progress track -->
    <div
      class="liquid-progress__track position-absolute"
      :class="computedRounded"
      :style="trackStyle"
    ></div>

    <!-- Glass shine overlay -->
    <div class="liquid-progress__shine position-absolute" :class="computedRounded"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type SizePreset = 'x-small' | 'small' | 'large' | 'x-large'

interface Props {
  /** 進度值 (0-100) */
  modelValue?: number
  /** 是否為不確定狀態（持續動畫） */
  indeterminate?: boolean
  /** 高度 */
  height?: number | string
  /**
   * 大小預設值
   * - 'x-small': 4px
   * - 'small': 6px
   * - 'large': 10px
   * - 'x-large': 14px
   */
  size?: SizePreset
  /** 圓角樣式 */
  rounded?: string
  /** 進度條顏色（Vuetify 顏色名稱或 CSS 顏色） */
  color?: string
  /** 背景顏色 */
  bgColor?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: 0,
  indeterminate: false,
  rounded: 'rounded-pill',
})

const SIZE_MAP = {
  'x-small': 4,
  small: 6,
  default: 8,
  large: 10,
  'x-large': 14,
}

const COLOR_MAP: Record<string, string> = {
  primary: '59, 130, 246',
  secondary: '139, 92, 246',
  success: '34, 197, 94',
  error: '239, 68, 68',
  warning: '245, 158, 11',
  info: '14, 165, 233',
  white: '255, 255, 255',
}

const computedHeight = computed(() => {
  if (props.height) {
    return typeof props.height === 'number' ? `${props.height}px` : props.height
  }
  if (props.size && props.size in SIZE_MAP) {
    return `${SIZE_MAP[props.size as keyof typeof SIZE_MAP]}px`
  }
  return `${SIZE_MAP.default}px`
})

const computedRounded = computed(() => props.rounded)

const containerStyle = computed(() => ({
  height: computedHeight.value,
}))

const trackStyle = computed(() => {
  const style: Record<string, string> = {
    width: props.indeterminate ? '30%' : `${Math.min(100, Math.max(0, props.modelValue))}%`,
  }

  // Apply color
  const colorKey = props.color || 'white'
  const rgb = COLOR_MAP[colorKey] || COLOR_MAP.white

  style.background = `linear-gradient(
    90deg,
    rgba(${rgb}, 0.6) 0%,
    rgba(${rgb}, 0.8) 50%,
    rgba(${rgb}, 0.6) 100%
  )`

  return style
})
</script>

<style scoped lang="scss">
.liquid-progress {
  width: 100%;
  overflow: hidden;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.liquid-progress__bg {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.liquid-progress__track {
  top: 0;
  left: 0;
  height: 100%;
  transition: width 0.3s ease;
  box-shadow:
    0 0 8px rgba(255, 255, 255, 0.3),
    inset 0 1px 1px rgba(255, 255, 255, 0.4);
}

.liquid-progress__shine {
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.2) 0%,
    transparent 50%,
    rgba(0, 0, 0, 0.05) 100%
  );
  pointer-events: none;
}

// Indeterminate animation
.liquid-progress--indeterminate .liquid-progress__track {
  animation: indeterminate 1.5s ease-in-out infinite;
}

@keyframes indeterminate {
  0% {
    left: -30%;
    width: 30%;
  }
  50% {
    width: 40%;
  }
  100% {
    left: 100%;
    width: 30%;
  }
}
</style>
