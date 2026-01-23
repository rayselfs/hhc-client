<template>
  <label
    class="liquid-switch"
    :class="{
      'liquid-switch--checked': modelValue,
      'liquid-switch--disabled': disabled,
    }"
  >
    <!-- Hidden native checkbox -->
    <input
      type="checkbox"
      class="liquid-switch__input"
      :checked="modelValue"
      :disabled="disabled"
      @change="handleChange"
    />

    <!-- Glass track -->
    <span class="liquid-switch__track">
      <span class="liquid-switch__track-glass"></span>
      <span class="liquid-switch__track-tint" :style="trackTintStyle"></span>
      <span class="liquid-switch__track-shine"></span>

      <!-- Thumb -->
      <span class="liquid-switch__thumb">
        <span class="liquid-switch__thumb-glass"></span>
        <span class="liquid-switch__thumb-shine"></span>
      </span>
    </span>

    <!-- Label -->
    <span v-if="label || $slots.default" class="liquid-switch__label">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useLiquidGlassFilters } from '../composables/useLiquidGlassFilters'

useLiquidGlassFilters()

interface Props {
  /** v-model 綁定值 */
  modelValue?: boolean
  /** 標籤文字 */
  label?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 啟用時的顏色 */
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  disabled: false,
  color: 'primary',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

// Color mappings
const COLOR_MAP: Record<string, string> = {
  primary: '59, 130, 246',
  secondary: '139, 92, 246',
  success: '34, 197, 94',
  error: '239, 68, 68',
  warning: '245, 158, 11',
  info: '14, 165, 233',
}

const trackTintStyle = computed(() => {
  if (!props.modelValue) return {}

  const rgb = COLOR_MAP[props.color] || COLOR_MAP.primary
  return {
    background: `rgba(${rgb}, 0.55)`,
  }
})

const handleChange = (event: Event) => {
  if (props.disabled) return
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.checked)
}
</script>

<style scoped lang="scss">
@use '../styles' as liquid;

.liquid-switch {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;

  &--disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }
}

.liquid-switch__input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.liquid-switch__track {
  position: relative;
  width: 52px;
  height: 31px;
  border-radius: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}

.liquid-switch__track-glass {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  @include liquid.liquid-glass-backdrop(12px, 180%);
}

.liquid-switch__track-tint {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: rgba(120, 120, 120, 0.25);
  transition: background 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.liquid-switch__track-shine {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow:
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.2),
    inset 0 1px 2px 0 rgba(255, 255, 255, 0.1),
    inset 0 -1px 2px 0 rgba(0, 0, 0, 0.1),
    0 1px 4px 0 rgba(0, 0, 0, 0.15);
  pointer-events: none;
}

.liquid-switch__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  .liquid-switch--checked & {
    transform: translateX(20px);
  }
}

.liquid-switch__thumb-glass {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: rgba(255, 255, 255, 0.95);
  @include liquid.liquid-glass-backdrop(8px, 150%);
}

.liquid-switch__thumb-shine {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow:
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.5),
    inset 0 2px 4px 0 rgba(255, 255, 255, 0.4),
    inset 0 -1px 2px 0 rgba(0, 0, 0, 0.05),
    0 2px 8px 0 rgba(0, 0, 0, 0.2),
    0 1px 2px 0 rgba(0, 0, 0, 0.15);
  pointer-events: none;
}

.liquid-switch__label {
  margin-left: 12px;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.9);
}

// Hover effect
.liquid-switch:hover:not(.liquid-switch--disabled) {
  .liquid-switch__track-shine {
    box-shadow:
      inset 0 0 0 0.5px rgba(255, 255, 255, 0.3),
      inset 0 1px 2px 0 rgba(255, 255, 255, 0.15),
      inset 0 -1px 2px 0 rgba(0, 0, 0, 0.1),
      0 2px 8px 0 rgba(0, 0, 0, 0.2);
  }
}

// Active (press) effect
.liquid-switch:active:not(.liquid-switch--disabled) {
  .liquid-switch__thumb {
    transform: scale(0.95);

    .liquid-switch--checked & {
      transform: translateX(20px) scale(0.95);
    }
  }
}
</style>
