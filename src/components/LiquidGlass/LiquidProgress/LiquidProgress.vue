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
import { getThemeColorVar, isThemeColor, getProgressHeight, isSizeKey, type SizeKey } from '../constants'

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

// Helper to get color variable
const getColorVar = (color: string): string => {
  if (color === 'white') return 'var(--hhc-glass-text)'
  if (isThemeColor(color)) return getThemeColorVar(color)
  return color
}

const computedHeight = computed(() => {
  if (props.height) {
    return typeof props.height === 'number' ? `${props.height}px` : props.height
  }
  if (props.size && isSizeKey(props.size)) {
    return `${getProgressHeight(props.size)}px`
  }
  return `${getProgressHeight('default')}px`
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
  const colorVar = getColorVar(props.color || 'white')

  style.background = `linear-gradient(
    90deg,
    rgba(${colorVar}, 0.6) 0%,
    rgba(${colorVar}, 0.8) 50%,
    rgba(${colorVar}, 0.6) 100%
  )`

  return style
})
</script>

<style scoped lang="scss">
@use '../styles' as liquid;

.liquid-progress {
  width: 100%;
  overflow: hidden;
  @include liquid.liquid-glass-backdrop(var(--hhc-blur-sm));
}

.liquid-progress__bg {
  position: absolute;
  inset: 0;
  background: rgba(var(--hhc-glass-tint), var(--hhc-progress-bg-opacity));
  box-shadow: inset 0 1px 2px rgba(var(--hhc-glass-shadow-color), 0.1);
}

.liquid-progress__track {
  top: 0;
  left: 0;
  height: 100%;
  transition: width var(--hhc-transition-normal) var(--hhc-transition-easing);
  box-shadow:
    0 0 8px rgba(var(--hhc-glass-shine-top), 0.3),
    inset 0 1px 1px rgba(var(--hhc-glass-shine-top), 0.4);
}

.liquid-progress__shine {
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(var(--hhc-glass-shine-top), 0.2) 0%,
    transparent 50%,
    rgba(var(--hhc-glass-shine-bottom), 0.05) 100%
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
