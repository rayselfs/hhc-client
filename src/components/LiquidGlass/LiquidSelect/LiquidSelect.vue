<template>
  <div
    class="liquid-select"
    :class="{
      'liquid-select--focused': isFocused,
      'liquid-select--disabled': disabled,
      'liquid-select--multiple': multiple,
    }"
  >
    <!-- Glass container -->
    <div class="liquid-select__container">
      <div class="liquid-select__glass"></div>
      <div class="liquid-select__tint"></div>
      <div class="liquid-select__shine"></div>

      <!-- v-select wrapper -->
      <VSelect
        ref="selectRef"
        :model-value="modelValue"
        :items="items"
        :label="label"
        :placeholder="placeholder"
        :disabled="disabled"
        :multiple="multiple"
        :clearable="clearable"
        :loading="loading"
        :search-input.sync="searchInput"
        variant="solo-filled"
        density="compact"
        hide-details
        @update:model-value="handleUpdate"
        @focus="handleFocus"
        @blur="handleBlur"
      >
        <!-- Loader slot - show LiquidProgressCircular when loading -->
        <template v-if="loading" #loader>
          <div class="liquid-select__loader">
            <LiquidProgressCircular
              :size="20"
              :width="2"
              indeterminate
              color="rgba(var(--hhc-glass-text), 0.7)"
            />
          </div>
        </template>

        <!-- No data slot - empty state message -->
        <template #no-data>
          <div class="liquid-select__no-data">
            {{ noDataText }}
          </div>
        </template>

        <!-- Append slot - clear icon styling -->
        <template v-if="clearable && modelValue" #append>
          <button type="button" class="liquid-select__clear-btn" @click.stop="handleClear">
            <LiquidIcon icon="mdi-close-circle" :size="18" />
          </button>
        </template>
      </VSelect>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { VSelect } from 'vuetify/components'
import { useLiquidGlassFilters } from '../composables/useLiquidGlassFilters'
import LiquidProgressCircular from '../LiquidProgressCircular/LiquidProgressCircular.vue'
import LiquidIcon from '../LiquidIcon/LiquidIcon.vue'

useLiquidGlassFilters()

interface Props {
  /** v-model 綁定值 */
  modelValue?: string | number | (string | number)[] | null
  /** 選項列表 */
  items?: (string | number | { title?: string; value: string | number })[]
  /** 標籤 */
  label?: string
  /** Placeholder */
  placeholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否多選 */
  multiple?: boolean
  /** 是否可清除 */
  clearable?: boolean
  /** 是否加載中 */
  loading?: boolean
  /** 無數據文字 */
  noDataText?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  items: () => [],
  disabled: false,
  multiple: false,
  clearable: false,
  loading: false,
  noDataText: 'No data available',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number | (string | number)[] | null): void
  (e: 'focus', event: FocusEvent): void
  (e: 'blur', event: FocusEvent): void
}>()

const selectRef = ref<InstanceType<typeof VSelect> | null>(null)
const isFocused = ref(false)
const searchInput = ref('')

const handleUpdate = (value: string | number | (string | number)[] | null) => {
  emit('update:modelValue', value)
}

const handleFocus = (event: FocusEvent) => {
  isFocused.value = true
  emit('focus', event)
}

const handleBlur = (event: FocusEvent) => {
  isFocused.value = false
  emit('blur', event)
}

const handleClear = () => {
  emit('update:modelValue', props.multiple ? [] : null)
}

// Expose focus method
defineExpose({
  focus: () => selectRef.value?.focus(),
  blur: () => selectRef.value?.blur(),
})
</script>

<style scoped lang="scss">
@use '../styles' as liquid;

.liquid-select {
  position: relative;
  min-width: 100px;

  &--disabled {
    @include liquid.liquid-disabled;
  }
}

.liquid-select__container {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 40px;
  border-radius: var(--hhc-radius-lg);
  overflow: hidden;
}

.liquid-select__glass {
  position: absolute;
  inset: 0;
  z-index: 0;
  @include liquid.liquid-glass-backdrop(var(--hhc-blur-md), 180%);
}

.liquid-select__tint {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: rgba(var(--hhc-glass-tint), var(--hhc-btn-tinted-opacity));
  transition: background var(--hhc-transition-fast) var(--hhc-transition-easing);

  .liquid-select--focused & {
    background: rgba(var(--hhc-glass-tint), var(--hhc-glass-tint-hover-opacity));
  }
}

.liquid-select__shine {
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

.liquid-select__loader {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  color: rgba(var(--hhc-glass-text), 0.7);
}

.liquid-select__no-data {
  padding: 12px 16px;
  text-align: center;
  color: rgba(var(--hhc-glass-text), 0.5);
  font-size: 0.875rem;
}

.liquid-select__clear-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  color: rgba(var(--hhc-glass-text), 0.5);
  cursor: pointer;
  border-radius: 50%;
  transition:
    color var(--hhc-transition-fast) var(--hhc-transition-easing),
    transform var(--hhc-transition-fast) var(--hhc-transition-easing);

  &:hover {
    color: rgba(var(--hhc-glass-text), 0.8);
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.95);
  }
}

// Override Vuetify v-select styles
:deep(.v-select) {
  .v-field {
    background: transparent;
    border: none;

    .v-field__input {
      color: rgba(var(--hhc-glass-text), 0.95);
      font-size: 0.875rem;
      padding: 0 14px;
    }

    .v-field__control {
      min-height: 40px;
    }
  }

  .v-select__selection {
    color: rgba(var(--hhc-glass-text), 0.95);
  }

  .v-field__append-inner {
    padding-right: 8px;
  }
}
</style>
