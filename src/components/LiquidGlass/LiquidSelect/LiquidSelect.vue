<template>
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
    class="liquid-select"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>

<script setup lang="ts">
import { useLiquidGlassFilters } from '../composables/useLiquidGlassFilters'
import type { SizeKey } from '../constants'

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
</script>

<style scoped lang="scss">
.liquid-select {
  // Basic structure - styling will be added in Task 2
}
</style>
