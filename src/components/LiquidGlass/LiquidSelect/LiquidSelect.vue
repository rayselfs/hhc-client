<template>
  <div
    class="liquid-select"
    :class="{
      'liquid-select--focused': isFocused,
      'liquid-select--disabled': disabled,
      'liquid-select--rounded': rounded,
    }"
  >
    <!-- Glass layers -->
    <div class="liquid-select__glass-effect" :class="computedRounded"></div>
    <div class="liquid-select__glass-tint" :class="computedRounded" :style="tintStyle"></div>
    <div class="liquid-select__glass-shine" :class="computedRounded"></div>

    <!-- v-select -->
    <v-select
      :model-value="modelValue"
      :items="items"
      :item-title="itemTitle"
      :item-value="itemValue"
      :multiple="multiple"
      :chips="chips"
      :closable-chips="closableChips"
      :clearable="clearable"
      :disabled="disabled"
      :loading="loading"
      :placeholder="placeholder"
      variant="solo-filled"
      :color="color"
      density="default"
      hide-details
      class="liquid-select__input"
      @update:model-value="emit('update:modelValue', $event)"
      @focus="isFocused = true"
      @blur="isFocused = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLiquidGlassFilters } from '../composables/useLiquidGlassFilters'
import { getThemeColorVar, isThemeColor, type SizeKey } from '../constants'

// Ensure SVG filters are injected (fallback if plugin not installed)
useLiquidGlassFilters()

type Variant = 'glass' | 'tinted'

interface Props {
  /** v-model 綁定值 */
  modelValue?: unknown
  /** 選項列表 */
  items?: unknown[]
  /** 選項標題字段名稱 */
  itemTitle?: string
  /** 選項值字段名稱 */
  itemValue?: string
  /** 是否支援多選 */
  multiple?: boolean
  /** 是否顯示選中項目為 chips */
  chips?: boolean
  /** chips 是否可關閉 */
  closableChips?: boolean
  /** 是否顯示清除按鈕 */
  clearable?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 是否顯示 loading 狀態 */
  loading?: boolean
  /** Placeholder 文字 */
  placeholder?: string
  /**
   * 選擇框變體樣式
   * - glass: 中性毛玻璃（預設）
   * - tinted: 帶色調的毛玻璃（需搭配 color）
   */
  variant?: Variant
  /** 顏色（Vuetify 顏色名稱或 CSS 顏色） */
  color?: string
  /** 大小 */
  size?: SizeKey
  /** 圓角樣式 */
  rounded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  multiple: false,
  chips: false,
  closableChips: false,
  clearable: false,
  disabled: false,
  loading: false,
  variant: 'glass',
  rounded: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown): void
}>()

const isFocused = ref(false)

// Helper to get color variable
const getColorVar = (color: string | undefined): string => {
  if (!color) return 'var(--hhc-glass-tint)'
  if (isThemeColor(color)) return getThemeColorVar(color)
  return color
}

const computedRounded = computed(() => {
  return props.rounded ? 'rounded-pill' : 'rounded-lg'
})

const tintStyle = computed(() => {
  if (!props.color) return {}

  const colorVar = getColorVar(props.color)

  if (props.variant === 'tinted') {
    return {
      background: `rgba(${colorVar}, var(--hhc-btn-tinted-opacity))`,
    }
  }

  return {}
})
</script>

<style scoped lang="scss">
@use '../styles' as liquid;

.liquid-select {
  position: relative;
  min-width: 220px;

  &--disabled {
    @include liquid.liquid-disabled;
  }
}

// Glass layers
.liquid-select__glass-effect {
  position: absolute;
  inset: 0;
  z-index: 0;
  @include liquid.liquid-glass-backdrop(var(--hhc-blur-md), 180%);
}

.liquid-select__glass-tint {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: rgba(var(--hhc-glass-tint), var(--hhc-btn-tinted-opacity));
  transition: background var(--hhc-transition-fast) var(--hhc-transition-easing);

  .liquid-select--focused & {
    background: rgba(var(--hhc-glass-tint), var(--hhc-glass-tint-hover-opacity));
  }
}

.liquid-select__glass-shine {
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: inherit;
  box-shadow:
    inset 0 0 0 1px rgba(var(--hhc-glass-border), var(--hhc-glass-border-opacity)),
    inset 0 1px 2px 0 rgba(var(--hhc-glass-shine-top), 0.1),
    inset 0 -1px 2px 0 rgba(var(--hhc-glass-shine-bottom), 0.08);
  pointer-events: none;
  transition: box-shadow var(--hhc-transition-fast) var(--hhc-transition-easing);

  .liquid-select--focused & {
    box-shadow:
      inset 0 0 0 1.5px rgba(var(--hhc-theme-primary), 0.5),
      inset 0 1px 2px 0 rgba(var(--hhc-glass-shine-top), 0.15),
      inset 0 -1px 2px 0 rgba(var(--hhc-glass-shine-bottom), 0.08),
      0 0 0 2px rgba(var(--hhc-theme-primary), 0.15);
  }
}

// Override Vuetify's default styling
.liquid-select__input {
  position: relative;
  z-index: 3;

  :deep(.v-field) {
    background: transparent !important;
    box-shadow: none !important;
  }

  :deep(.v-field__overlay) {
    opacity: 0 !important;
  }

  :deep(.v-field__outline) {
    display: none !important;
  }

  :deep(.v-field__input) {
    color: rgba(var(--hhc-glass-text), 0.95);
  }

  :deep(.v-select__menu-icon) {
    color: rgba(var(--hhc-glass-text), 0.7);
  }
}
</style>
