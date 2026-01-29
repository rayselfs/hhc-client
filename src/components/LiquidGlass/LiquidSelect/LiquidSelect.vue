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
      :menu-props="{ contentClass: 'liquid-select-menu' }"
      @update:model-value="emit('update:modelValue', $event)"
      @focus="isFocused = true"
      @blur="isFocused = false"
    >
      <!-- Override chip slot with LiquidChip -->
      <template v-if="chips" #chip="{ item, props: chipProps }">
        <LiquidChip
          v-bind="chipProps"
          :closable="closableChips"
          size="small"
          :color="color"
          variant="tinted"
          class="liquid-select__chip"
        >
          {{ item.title }}
        </LiquidChip>
      </template>

      <!-- Override item slot with LiquidListItem -->
      <template #item="{ item, props: itemProps }">
        <LiquidListItem
          v-bind="itemProps"
          :selected="isItemSelected(item)"
          :color="color || 'primary'"
          :hover-opacity="0.12"
          :selected-opacity="0.2"
          rounded="rounded-lg"
          padding="py-2 px-3"
        >
          {{ item.title }}
        </LiquidListItem>
      </template>

      <!-- Override loader slot with LiquidProgressCircular -->
      <template v-if="loading" #loader>
        <LiquidProgressCircular
          :size="20"
          :width="2"
          indeterminate
          :color="color || 'primary'"
          class="liquid-select__loader"
        />
      </template>

      <!-- Override no-data slot for empty state -->
      <template #no-data>
        <div class="liquid-select__no-data">
          <span class="text-body-2">No data available</span>
        </div>
      </template>
    </v-select>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLiquidGlassFilters } from '../composables/useLiquidGlassFilters'
import { getThemeColorVar, isThemeColor, type SizeKey } from '../constants'
import { LiquidChip } from '../LiquidChip'
import { LiquidListItem } from '../LiquidListItem'
import { LiquidProgressCircular } from '../LiquidProgressCircular'

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

// Check if an item is selected
const isItemSelected = (item: any) => {
  if (!props.modelValue) return false

  if (props.multiple) {
    // For multiple selection, modelValue is an array
    return Array.isArray(props.modelValue) && props.modelValue.some((v: any) => v === item.value)
  }

  // For single selection, modelValue is a single value
  return props.modelValue === item.value
}
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

  // Clear icon styling
  :deep(.v-field__clearable) {
    color: rgba(var(--hhc-glass-text), 0.5);
    transition:
      color var(--hhc-transition-fast) var(--hhc-transition-easing),
      opacity var(--hhc-transition-fast) var(--hhc-transition-easing);

    &:hover {
      color: rgba(var(--hhc-glass-text), 0.8);
    }
  }

  // Chip container styling
  :deep(.v-field__input) {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    gap: 4px;

    // Hide scrollbar but keep functionality
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
}

.liquid-select__chip {
  flex-shrink: 0;
}

.liquid-select__loader {
  margin: 0 8px;
}

.liquid-select__no-data {
  padding: 16px;
  text-align: center;
  color: rgba(var(--hhc-glass-text), 0.6);
}
</style>
