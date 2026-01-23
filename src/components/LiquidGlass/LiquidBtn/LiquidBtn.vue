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
    @click="handleClick"
  >
    <!-- Glass layers (for glass/tinted variants) -->
    <template v-if="hasGlassEffect">
      <div class="liquid-btn__glass-effect" :class="computedRounded"></div>
      <div class="liquid-btn__glass-tint" :class="computedRounded" :style="tintStyle"></div>
      <div class="liquid-btn__glass-shine" :class="computedRounded"></div>
    </template>

    <!-- Content -->
    <span
      class="liquid-btn__content d-flex align-center justify-center"
      :class="{ 'flex-column': stacked }"
      :style="contentStyle"
    >
      <!-- Loading spinner -->
      <v-progress-circular
        v-if="loading"
        indeterminate
        :size="computedSizes.icon"
        :width="2"
        class="liquid-btn__loader"
      />

      <template v-else>
        <!-- Prepend icon -->
        <v-icon
          v-if="prependIcon"
          :size="computedSizes.icon"
          class="liquid-btn__prepend"
          :class="prependIconSpacing"
        >
          {{ prependIcon }}
        </v-icon>

        <!-- Icon only mode -->
        <v-icon v-if="iconOnly" :size="computedSizes.icon">
          {{ icon }}
        </v-icon>

        <!-- Default slot (text) -->
        <span v-if="hasText" class="liquid-btn__text" :style="{ fontSize: computedSizes.text }">
          <slot></slot>
        </span>

        <!-- Append icon -->
        <v-icon
          v-if="appendIcon"
          :size="computedSizes.icon"
          class="liquid-btn__append"
          :class="appendIconSpacing"
        >
          {{ appendIcon }}
        </v-icon>
      </template>
    </span>
  </component>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useLiquidGlassFilters } from '../composables/useLiquidGlassFilters'

// Ensure SVG filters are injected (fallback if plugin not installed)
useLiquidGlassFilters()

type SizePreset = 'x-small' | 'small' | 'large' | 'x-large'
type Variant = 'glass' | 'tinted' | 'outlined' | 'text' | 'flat'
type Density = 'default' | 'comfortable' | 'compact'

interface Props {
  /**
   * 按鈕變體樣式
   * - glass: 中性毛玻璃（預設）
   * - tinted: 帶色調的毛玻璃（需搭配 color）
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

// Size mappings
const SIZE_MAP = {
  'x-small': { icon: 16, text: '0.625rem', height: 28, padding: '0 10px', iconPadding: '0 6px' },
  small: { icon: 18, text: '0.75rem', height: 32, padding: '0 14px', iconPadding: '0 8px' },
  default: { icon: 20, text: '0.875rem', height: 40, padding: '0 18px', iconPadding: '0 10px' },
  large: { icon: 24, text: '1rem', height: 48, padding: '0 22px', iconPadding: '0 12px' },
  'x-large': { icon: 28, text: '1.125rem', height: 56, padding: '0 28px', iconPadding: '0 14px' },
}

const DENSITY_SCALE = {
  default: 1,
  comfortable: 0.9,
  compact: 0.8,
}

// Color mappings for tinted glass
const COLOR_MAP: Record<string, string> = {
  primary: '59, 130, 246',
  secondary: '139, 92, 246',
  success: '34, 197, 94',
  error: '239, 68, 68',
  warning: '245, 158, 11',
  info: '14, 165, 233',
}

// Computed properties
const tag = computed(() => {
  if (props.href) return 'a'
  if (props.to) return 'router-link'
  return 'button'
})

const hasText = computed(() => !!slots.default)
const iconOnly = computed(() => !!props.icon && !hasText.value)
const hasGlassEffect = computed(() => props.variant === 'glass' || props.variant === 'tinted')

const computedRounded = computed(() => {
  if (props.rounded) return props.rounded
  return iconOnly.value ? 'rounded-circle' : 'rounded-pill'
})

const computedSizes = computed(() => {
  let base = SIZE_MAP.default

  if (props.size) {
    if (typeof props.size === 'string' && props.size in SIZE_MAP) {
      base = SIZE_MAP[props.size as keyof typeof SIZE_MAP]
    } else if (typeof props.size === 'number') {
      const s = props.size
      base = {
        icon: s,
        text: `${Math.round(s * 0.55)}px`,
        height: Math.round(s * 1.8),
        padding: `0 ${Math.round(s * 0.75)}px`,
        iconPadding: `0 ${Math.round(s * 0.4)}px`,
      }
    }
  }

  const scale = DENSITY_SCALE[props.density]

  return {
    icon: props.iconSize ?? Math.round(base.icon * scale),
    text: props.fontSize ?? base.text,
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
  if (props.variant !== 'tinted' || !props.color) return {}

  const rgb = COLOR_MAP[props.color] || '255, 255, 255'
  return {
    background: `rgba(${rgb}, 0.2)`,
  }
})

const contentStyle = computed(() => {
  if (!props.color) return {}

  // For non-tinted variants, apply color to content
  if (props.variant !== 'tinted') {
    const rgb = COLOR_MAP[props.color]
    if (rgb) {
      return { color: `rgb(${rgb})` }
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
.liquid-btn {
  border: none;
  cursor: pointer;
  font-weight: 500;
  text-decoration: none;
  color: rgba(255, 255, 255, 0.9);
  overflow: hidden;
  transition:
    transform 0.2s ease,
    opacity 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;

  &:hover:not(.liquid-btn--disabled) {
    transform: scale(1.02);
  }

  &:active:not(.liquid-btn--disabled) {
    transform: scale(0.97);
  }

  &--disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
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
  &--tinted {
    background: transparent;
    box-shadow:
      0 4px 8px rgba(0, 0, 0, 0.15),
      0 0 16px rgba(0, 0, 0, 0.08);

    &:hover:not(.liquid-btn--disabled) {
      box-shadow:
        0 6px 12px rgba(0, 0, 0, 0.2),
        0 0 20px rgba(0, 0, 0, 0.1);
    }
  }

  // Outlined: 玻璃邊框
  &--outlined {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.25);
    box-shadow: none;

    &:hover:not(.liquid-btn--disabled) {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.4);
    }
  }

  // Text: 純文字
  &--text {
    background: transparent;
    box-shadow: none;

    &:hover:not(.liquid-btn--disabled) {
      background: rgba(255, 255, 255, 0.08);
    }
  }

  // Flat: 半透明純色
  &--flat {
    background: rgba(255, 255, 255, 0.12);
    box-shadow: none;

    &:hover:not(.liquid-btn--disabled) {
      background: rgba(255, 255, 255, 0.18);
    }
  }
}

// ===== Glass Effect Layers =====
.liquid-btn__glass-effect {
  position: absolute;
  inset: 0;
  z-index: 0;
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
}

.liquid-btn__glass-tint {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: rgba(40, 40, 40, 0.35);
}

.liquid-btn__glass-shine {
  position: absolute;
  inset: 0;
  z-index: 2;
  box-shadow:
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.15),
    inset 0 -1px 1px 0 rgba(0, 0, 0, 0.1);
  pointer-events: none;
}

.liquid-btn__content {
  position: relative;
  z-index: 3;
}

.liquid-btn__loader {
  color: currentColor;
}

.liquid-btn__text {
  line-height: 1.2;
  white-space: nowrap;
}
</style>
