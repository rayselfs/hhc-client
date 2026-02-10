<template>
  <component
    :is="tag"
    class="liquid-btn position-relative d-inline-flex align-center justify-center"
    :class="btnClasses"
    :style="btnStyle"
    :disabled="disabled || loading"
    :type="tag === 'button' ? 'button' : undefined"
    :href="href"
    :to="to"
    :aria-label="ariaLabel"
    @click="handleClick"
  >
    <!-- Glass layers (for glass/tinted/solid variants) -->
    <template v-if="hasGlassEffect">
      <div class="liquid-btn__glass-effect" :class="computedRounded"></div>
      <div class="liquid-btn__glass-tint" :class="computedRounded" :style="tintStyle"></div>
      <div class="liquid-btn__glass-shine" :class="computedRounded" :style="shineStyle"></div>
    </template>

    <!-- Content -->
    <span
      class="liquid-btn__content d-flex align-center justify-center"
      :class="{ 'flex-column': stacked }"
      :style="contentStyle"
    >
      <!-- Loading spinner -->
      <LiquidProgressCircular
        v-if="loading"
        indeterminate
        :size="computedSizes.icon"
        :width="2"
        class="liquid-btn__loader"
      />

      <template v-else>
        <!-- Prepend icon -->
        <LiquidIcon
          v-if="prependIcon"
          :icon="prependIcon"
          :size="computedSizes.icon"
          class="liquid-btn__prepend"
          :class="prependIconSpacing"
        />

        <!-- Icon only mode -->
        <LiquidIcon v-if="iconOnly" :icon="icon!" :size="computedSizes.icon" />

        <!-- Default slot (text) -->
        <span v-if="hasText" class="liquid-btn__text" :style="{ fontSize: computedSizes.text }">
          <slot></slot>
        </span>

        <!-- Append icon -->
        <LiquidIcon
          v-if="appendIcon"
          :icon="appendIcon"
          :size="computedSizes.icon"
          class="liquid-btn__append"
          :class="appendIconSpacing"
        />
      </template>
    </span>
  </component>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useLiquidGlassFilters } from '../composables/useLiquidGlassFilters'
import {
  getThemeColorVar,
  isThemeColor,
  getButtonSizeConfig,
  isSizeKey,
  type SizeKey,
} from '../constants'
import LiquidIcon from '../LiquidIcon/LiquidIcon.vue'
import LiquidProgressCircular from '../LiquidProgressCircular/LiquidProgressCircular.vue'

// Ensure SVG filters are injected (fallback if plugin not installed)
useLiquidGlassFilters()

type SizePreset = 'x-small' | 'small' | 'large' | 'x-large'
type Variant = 'glass' | 'tinted' | 'solid' | 'outlined' | 'text' | 'flat'
type Density = 'default' | 'comfortable' | 'compact'

interface Props {
  /**
   * 按鈕變體樣式
   * - glass: 中性毛玻璃（預設）
   * - tinted: 帶色調的毛玻璃（需搭配 color）
   * - solid: 鮮明色調的毛玻璃，適合主要 CTA（需搭配 color）
   * - outlined: 玻璃邊框
   * - text: 純文字，無背景
   * - flat: 半透明純色背景
   */
  variant?: Variant
  /** 顏色（Vuetify 顏色名稱或 CSS 顏色） */
  color?: string
  /** 圓角樣式，icon-only 時自動為圓形 */
  rounded?: string
  /**
   * 按鈕大小
   * - 預設值: 'x-small' | 'small' | 'large' | 'x-large'
   * - 數字: 自訂像素大小
   */
  size?: SizePreset | number
  /** 密度: 'default' | 'comfortable' | 'compact' */
  density?: Density
  /** Icon-only 模式，傳入 icon 名稱 */
  icon?: string
  /** 前置 icon */
  prependIcon?: string
  /** 後置 icon */
  appendIcon?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否顯示 loading 狀態 */
  loading?: boolean
  /** 是否佔滿寬度 */
  block?: boolean
  /** 是否堆疊 (icon 在文字上方) */
  stacked?: boolean
  /** 連結 href (會渲染為 <a>) */
  href?: string
  /** Vue Router 路由 (會渲染為 <router-link>) */
  to?: RouteLocationRaw
  /** 覆蓋 icon 大小 */
  iconSize?: string | number
  /** 覆蓋文字大小 */
  fontSize?: string
  /** ARIA 標籤 */
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'glass',
  density: 'default',
  disabled: false,
  loading: false,
  block: false,
  stacked: false,
})

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const slots = useSlots()

const DENSITY_SCALE = {
  default: 1,
  comfortable: 0.9,
  compact: 0.8,
}

// Helper to get color variable
const getColorVar = (color: string | undefined): string => {
  if (!color) return 'var(--hhc-glass-tint, 255, 255, 255)'
  if (isThemeColor(color)) return getThemeColorVar(color)
  return color
}

// Computed properties
const tag = computed(() => {
  if (props.href) return 'a'
  if (props.to) return 'router-link'
  return 'button'
})

const hasText = computed(() => !!slots.default)
const iconOnly = computed(() => !!props.icon && !hasText.value)
const hasGlassEffect = computed(
  () => props.variant === 'glass' || props.variant === 'tinted' || props.variant === 'solid',
)

const computedRounded = computed(() => {
  if (props.rounded) {
    // If already prefixed with 'rounded', use as-is; otherwise add prefix
    return props.rounded.startsWith('rounded') ? props.rounded : `rounded-${props.rounded}`
  }
  return iconOnly.value ? 'rounded-circle' : 'rounded-pill'
})

const computedSizes = computed(() => {
  // Get base size from shared constants
  const sizeKey: SizeKey | number =
    props.size && isSizeKey(props.size) ? props.size : (props.size ?? 'default')
  const base = getButtonSizeConfig(sizeKey)

  const scale = DENSITY_SCALE[props.density]

  // Ensure icon size is a number
  let iconSizeNum = Math.round(base.icon * scale)
  if (props.iconSize != null) {
    iconSizeNum = typeof props.iconSize === 'number' ? props.iconSize : parseInt(props.iconSize, 10)
  }

  return {
    icon: iconSizeNum,
    text: props.fontSize ?? base.fontSize,
    height: Math.round(base.height * scale),
    padding: base.padding,
    iconPadding: base.iconPadding,
  }
})

const btnClasses = computed(() => [
  computedRounded.value,
  `liquid-btn--${props.variant}`,
  {
    'liquid-btn--icon-only': iconOnly.value,
    'liquid-btn--block': props.block,
    'liquid-btn--disabled': props.disabled,
    'liquid-btn--loading': props.loading,
  },
])

const btnStyle = computed(() => {
  const style: Record<string, string> = {
    minHeight: `${computedSizes.value.height}px`,
  }

  if (iconOnly.value) {
    style.width = `${computedSizes.value.height}px`
    style.padding = '0'
  } else {
    style.padding = computedSizes.value.padding
  }

  return style
})

const tintStyle = computed(() => {
  if (!props.color) return {}

  const colorVar = getColorVar(props.color)

  if (props.variant === 'solid') {
    // Solid: 更高不透明度，更鮮明
    return {
      background: `rgba(${colorVar}, var(--hhc-btn-solid-opacity))`,
    }
  }

  if (props.variant === 'tinted') {
    // Tinted: 淡淡的色調
    return {
      background: `rgba(${colorVar}, var(--hhc-btn-tinted-opacity))`,
    }
  }

  return {}
})

// Solid variant 的外發光樣式
const shineStyle = computed(() => {
  if (props.variant !== 'solid' || !props.color) return {}

  const colorVar = getColorVar(props.color)

  return {
    boxShadow: `
      inset 0 0 0 0.5px rgba(var(--hhc-glass-shine-top), 0.4),
      inset 0 1px 3px 0 rgba(var(--hhc-glass-shine-top), 0.25),
      inset 0 -1px 3px 0 rgba(var(--hhc-glass-shine-bottom), 0.1),
      0 2px 8px 0 rgba(${colorVar}, 0.35),
      0 4px 16px 0 rgba(${colorVar}, 0.25),
      0 0 1px 0 rgba(var(--hhc-glass-shadow-color), 0.1)
    `.trim(),
  }
})

const contentStyle = computed(() => {
  // Solid variant: Force white text for better contrast on colored backgrounds
  if (props.variant === 'solid') {
    return { color: 'rgba(255, 255, 255, 0.95)' }
  }

  if (!props.color) return {}

  // For non-tinted variants, apply color to content
  if (props.variant !== 'tinted') {
    if (isThemeColor(props.color)) {
      return { color: `rgb(${getThemeColorVar(props.color)})` }
    }
    return { color: props.color }
  }

  return {}
})

const prependIconSpacing = computed(() => {
  if (!hasText.value) return ''
  return props.stacked ? 'mb-1' : 'mr-2'
})

const appendIconSpacing = computed(() => {
  if (!hasText.value) return ''
  return props.stacked ? 'mt-1' : 'ml-2'
})

const handleClick = (event: MouseEvent) => {
  if (props.disabled || props.loading) return
  emit('click', event)
}
</script>

<style scoped lang="scss">
@use '../styles' as liquid;

.liquid-btn {
  border: none;
  cursor: pointer;
  font-weight: 500;
  text-decoration: none;
  color: rgba(var(--hhc-glass-text, 0, 0, 0), var(--hhc-glass-text-opacity, 1));
  overflow: hidden;
  transition:
    transform var(--hhc-transition-fast, 150ms)
      var(--hhc-transition-easing, cubic-bezier(0.4, 0, 0.2, 1)),
    opacity var(--hhc-transition-fast, 150ms)
      var(--hhc-transition-easing, cubic-bezier(0.4, 0, 0.2, 1)),
    box-shadow var(--hhc-transition-fast, 150ms)
      var(--hhc-transition-easing, cubic-bezier(0.4, 0, 0.2, 1)),
    background var(--hhc-transition-fast, 150ms)
      var(--hhc-transition-easing, cubic-bezier(0.4, 0, 0.2, 1));
  user-select: none;
  -webkit-tap-highlight-color: transparent;

  &:hover:not(.liquid-btn--disabled) {
    transform: scale(1.02);
  }

  &:active:not(.liquid-btn--disabled) {
    transform: scale(0.97);
  }

  &--disabled {
    @include liquid.liquid-disabled;
  }

  &--loading {
    cursor: wait;
  }

  &--block {
    display: flex;
    width: 100%;
  }

  // ===== Variants =====

  // Glass: 中性毛玻璃
  &--glass,
  &--tinted,
  &--solid {
    background: transparent;
  }

  // Solid: 帶顏色外發光 (glow 由 __glass-shine 處理)

  // Outlined: 玻璃邊框
  &--outlined {
    background: rgba(var(--hhc-glass-tint, 255, 255, 255), 0.05);
    border: 1px solid rgba(var(--hhc-glass-border, 0, 0, 0), var(--hhc-glass-border-opacity, 0.12));
    box-shadow: none;

    &:hover:not(.liquid-btn--disabled) {
      background: rgba(var(--hhc-glass-tint, 255, 255, 255), 0.1);
      border-color: rgba(
        var(--hhc-glass-border, 0, 0, 0),
        var(--hhc-glass-border-hover-opacity, 0.18)
      );
    }
  }

  // Text: 純文字
  &--text {
    background: transparent;
    box-shadow: none;

    &:hover:not(.liquid-btn--disabled) {
      background: rgba(var(--hhc-glass-tint, 255, 255, 255), 0.08);
    }
  }

  // Flat: 半透明純色
  &--flat {
    background: rgba(var(--hhc-glass-tint, 255, 255, 255), 0.12);
    box-shadow: none;

    &:hover:not(.liquid-btn--disabled) {
      background: rgba(var(--hhc-glass-tint, 255, 255, 255), var(--hhc-glass-tint-opacity, 0.08));
    }
  }
}

// ===== Glass Effect Layers =====
.liquid-btn__glass-effect {
  position: absolute;
  inset: 0;
  z-index: 0;
  @include liquid.liquid-glass-backdrop;
}

.liquid-btn__glass-tint {
  position: absolute;
  inset: 0;
  z-index: 1;
  @include liquid.liquid-glass-tint;
  transition: background var(--hhc-transition-normal, 300ms)
    var(--hhc-transition-easing, cubic-bezier(0.4, 0, 0.2, 1));
}

.liquid-btn__glass-shine {
  position: absolute;
  inset: 0;
  z-index: 2;
  @include liquid.liquid-glass-pill-shadow;
  pointer-events: none;

  .liquid-btn:hover:not(.liquid-btn--disabled) & {
    @include liquid.liquid-glass-pill-shadow-hover;
  }
  transition: box-shadow var(--hhc-transition-normal, 300ms)
    var(--hhc-transition-easing, cubic-bezier(0.4, 0, 0.2, 1));
}

.liquid-btn__content {
  position: relative;
  z-index: 3;
  transition: color var(--hhc-transition-normal, 300ms)
    var(--hhc-transition-easing, cubic-bezier(0.4, 0, 0.2, 1));
}

.liquid-btn__loader {
  color: currentColor;
}

.liquid-btn__text {
  line-height: 1.2;
  white-space: nowrap;
}
</style>
