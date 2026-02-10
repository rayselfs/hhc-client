<template>
  <div
    class="liquid-text-field"
    :class="{
      'liquid-text-field--focused': isFocused,
      'liquid-text-field--disabled': disabled,
      'liquid-text-field--rounded': rounded,
    }"
  >
    <!-- Glass container -->
    <div class="liquid-text-field__container">
      <div class="liquid-text-field__glass"></div>
      <div class="liquid-text-field__tint"></div>
      <div class="liquid-text-field__shine"></div>

      <!-- Prepend slot -->
      <div v-if="$slots.prepend || prependIcon" class="liquid-text-field__prepend">
        <slot name="prepend">
          <LiquidIcon v-if="prependIcon" :icon="prependIcon" :size="20" />
        </slot>
      </div>

      <!-- Input -->
      <input
        ref="inputRef"
        class="liquid-text-field__input"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :maxlength="maxlength"
        :aria-label="ariaLabel"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keyup.enter="$emit('keyup:enter', $event)"
      />

      <!-- Suffix -->
      <span v-if="suffix" class="liquid-text-field__suffix">{{ suffix }}</span>

      <!-- Append slot -->
      <div v-if="$slots.append || appendIcon" class="liquid-text-field__append">
        <slot name="append">
          <LiquidIcon v-if="appendIcon" :icon="appendIcon" :size="20" />
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useLiquidGlassFilters } from '../composables/useLiquidGlassFilters'
import LiquidIcon from '../LiquidIcon/LiquidIcon.vue'

useLiquidGlassFilters()

interface Props {
  /** v-model 綁定值 */
  modelValue?: string | number
  /** Placeholder */
  placeholder?: string
  /** 輸入類型 */
  type?: 'text' | 'number' | 'password' | 'email'
  /** 是否禁用 */
  disabled?: boolean
  /** 後綴文字 */
  suffix?: string
  /** 最大長度 */
  maxlength?: number | string
  /** 前置 icon */
  prependIcon?: string
  /** 後置 icon */
  appendIcon?: string
  /** 左右兩邊圓弧 (pill 形狀) */
  rounded?: boolean
  /** ARIA 標籤 */
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'text',
  disabled: false,
  rounded: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
  (e: 'focus', event: FocusEvent): void
  (e: 'blur', event: FocusEvent): void
  (e: 'keyup:enter', event: KeyboardEvent): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const isFocused = ref(false)

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  const value = props.type === 'number' ? target.value : target.value
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

// Expose focus method
defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
})
</script>

<style scoped lang="scss">
@use '../styles' as liquid;

.liquid-text-field {
  position: relative;
  min-width: 100px;

  &--disabled {
    @include liquid.liquid-disabled;
  }
}

.liquid-text-field__container {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 40px;
  padding: 0 14px;
  border-radius: var(--hhc-radius-lg, 8px);
  overflow: hidden;

  .liquid-text-field--rounded & {
    border-radius: var(--hhc-radius-pill, 9999px);
    padding: 0 18px;
  }
}

.liquid-text-field__glass {
  position: absolute;
  inset: 0;
  z-index: 0;
  @include liquid.liquid-glass-backdrop(var(--hhc-blur-md, 8px), 180%);
}

.liquid-text-field__tint {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: rgba(var(--hhc-glass-tint, 255, 255, 255), var(--hhc-btn-tinted-opacity, 0.04));
  transition: background var(--hhc-transition-fast, 150ms)
    var(--hhc-transition-easing, cubic-bezier(0.4, 0, 0.2, 1));

  .liquid-text-field--focused & {
    background: rgba(
      var(--hhc-glass-tint, 255, 255, 255),
      var(--hhc-glass-tint-hover-opacity, 0.08)
    );
  }
}

.liquid-text-field__shine {
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: inherit;
  box-shadow:
    inset 0 0 0 1px rgba(var(--hhc-glass-border, 0, 0, 0), var(--hhc-glass-border-opacity, 0.12)),
    inset 0 1px 2px 0 rgba(var(--hhc-glass-shine-top, 255, 255, 255), 0.1),
    inset 0 -1px 2px 0 rgba(var(--hhc-glass-shine-bottom, 0, 0, 0), 0.08);
  pointer-events: none;
  transition: box-shadow var(--hhc-transition-fast, 150ms)
    var(--hhc-transition-easing, cubic-bezier(0.4, 0, 0.2, 1));

  .liquid-text-field--focused & {
    box-shadow:
      inset 0 0 0 1.5px rgba(var(--hhc-theme-primary, 25, 118, 210), 0.5),
      inset 0 1px 2px 0 rgba(var(--hhc-glass-shine-top, 255, 255, 255), 0.15),
      inset 0 -1px 2px 0 rgba(var(--hhc-glass-shine-bottom, 0, 0, 0), 0.08),
      0 0 0 2px rgba(var(--hhc-theme-primary, 25, 118, 210), 0.15);
  }
}

.liquid-text-field__input {
  flex: 1;
  position: relative;
  z-index: 3;
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.875rem;
  color: rgba(var(--hhc-glass-text, 0, 0, 0), 0.95);
  padding: 0;

  &::placeholder {
    color: rgba(var(--hhc-glass-text, 0, 0, 0), var(--hhc-glass-text-disabled-opacity, 0.4));
  }

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  &[type='number'] {
    -moz-appearance: textfield;
  }
}

.liquid-text-field__prepend,
.liquid-text-field__append {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  color: rgba(var(--hhc-glass-text, 0, 0, 0), 0.7);
}

.liquid-text-field__prepend {
  margin-right: 10px;
}

.liquid-text-field__append {
  margin-left: 10px;
}

.liquid-text-field__suffix {
  position: relative;
  z-index: 3;
  margin-left: 8px;
  font-size: 0.875rem;
  @include liquid.liquid-glass-text-muted;
  white-space: nowrap;
}
</style>
