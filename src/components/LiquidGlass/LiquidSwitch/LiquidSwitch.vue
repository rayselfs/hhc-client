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
      :aria-label="ariaLabel"
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
import { getThemeColorVar, isThemeColor } from '../constants'

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
  /** ARIA 標籤 */
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  disabled: false,
  color: 'primary',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

// Helper to get color variable
const getColorVar = (color: string): string => {
  if (isThemeColor(color)) return getThemeColorVar(color)
  return color
}

const trackTintStyle = computed(() => {
  if (!props.modelValue) return {}

  const colorVar = getColorVar(props.color)
  return {
    background: `rgba(${colorVar}, var(--hhc-btn-solid-opacity))`,
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
    @include liquid.liquid-disabled;
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
  transition: all var(--hhc-transition-normal, 300ms)
    var(--hhc-transition-easing, cubic-bezier(0.4, 0, 0.2, 1));
  flex-shrink: 0;
}

.liquid-switch__track-glass {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  @include liquid.liquid-glass-backdrop(var(--hhc-blur-md, 8px), 180%);
}

.liquid-switch__track-tint {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: rgba(
    var(--hhc-switch-track-tint, 0, 0, 0),
    var(--hhc-glass-tint-hover-opacity, 0.08)
  );
  transition: background var(--hhc-transition-normal, 300ms)
    var(--hhc-transition-easing, cubic-bezier(0.4, 0, 0.2, 1));
}

.liquid-switch__track-shine {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow:
    inset 0 0 0 0.5px rgba(var(--hhc-glass-border, 0, 0, 0), 0.2),
    inset 0 1px 2px 0 rgba(var(--hhc-glass-shine-top, 255, 255, 255), 0.1),
    inset 0 -1px 2px 0 rgba(var(--hhc-glass-shine-bottom, 0, 0, 0), 0.1),
    0 1px 4px 0 rgba(var(--hhc-glass-shadow-color, 0, 0, 0), 0.15);
  pointer-events: none;
}

.liquid-switch__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  transition: transform var(--hhc-transition-normal, 300ms)
    var(--hhc-transition-easing, cubic-bezier(0.4, 0, 0.2, 1));

  .liquid-switch--checked & {
    transform: translateX(20px);
  }
}

.liquid-switch__thumb-glass {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: rgba(var(--hhc-switch-thumb, 255, 255, 255), 0.95);
  @include liquid.liquid-glass-backdrop(var(--hhc-blur-sm, 4px), 150%);
}

.liquid-switch__thumb-shine {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow:
    inset 0 0 0 0.5px rgba(var(--hhc-glass-shine-top, 255, 255, 255), 0.5),
    inset 0 2px 4px 0 rgba(var(--hhc-glass-shine-top, 255, 255, 255), 0.4),
    inset 0 -1px 2px 0 rgba(var(--hhc-glass-shine-bottom, 0, 0, 0), 0.05),
    0 2px 8px 0 rgba(var(--hhc-glass-shadow-color, 0, 0, 0), 0.2),
    0 1px 2px 0 rgba(var(--hhc-glass-shadow-color, 0, 0, 0), 0.15);
  pointer-events: none;
}

.liquid-switch__label {
  margin-left: 12px;
  font-size: 0.875rem;
  @include liquid.liquid-glass-text;
}

// Hover effect
.liquid-switch:hover:not(.liquid-switch--disabled) {
  .liquid-switch__track-shine {
    box-shadow:
      inset 0 0 0 0.5px rgba(var(--hhc-glass-border), 0.3),
      inset 0 1px 2px 0 rgba(var(--hhc-glass-shine-top), 0.15),
      inset 0 -1px 2px 0 rgba(var(--hhc-glass-shine-bottom), 0.1),
      0 2px 8px 0 rgba(var(--hhc-glass-shadow-color), 0.2);
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
