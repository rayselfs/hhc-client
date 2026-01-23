<template>
  <component
    :is="clickable ? 'button' : 'span'"
    class="liquid-chip position-relative d-inline-flex align-center"
    :class="chipClasses"
    :style="chipStyle"
    :type="clickable ? 'button' : undefined"
    @click="handleClick"
  >
    <!-- Glass layers -->
    <template v-if="hasGlassEffect">
      <div class="liquid-chip__glass-effect rounded-pill"></div>
      <div class="liquid-chip__glass-tint rounded-pill" :style="tintStyle"></div>
      <div class="liquid-chip__glass-shine rounded-pill" :style="shineStyle"></div>
    </template>

    <!-- Content -->
    <span class="liquid-chip__content d-flex align-center">
      <!-- Prepend icon -->
      <v-icon v-if="prependIcon" :size="iconSize" class="liquid-chip__prepend mr-1">
        {{ prependIcon }}
      </v-icon>

      <!-- Label -->
      <span class="liquid-chip__label">
        <slot>{{ label }}</slot>
      </span>

      <!-- Append icon -->
      <v-icon v-if="appendIcon" :size="iconSize" class="liquid-chip__append ml-1">
        {{ appendIcon }}
      </v-icon>

      <!-- Close button -->
      <button
        v-if="closable"
        type="button"
        class="liquid-chip__close ml-1"
        @click.stop="handleClose"
      >
        <v-icon :size="closeIconSize">mdi-close</v-icon>
      </button>
    </span>
  </component>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { useLiquidGlassFilters } from '../composables/useLiquidGlassFilters'

useLiquidGlassFilters()

type SizePreset = 'x-small' | 'small' | 'default' | 'large'
type Variant = 'glass' | 'tinted' | 'solid' | 'outlined'

interface Props {
  label?: string
  size?: SizePreset
  variant?: Variant
  color?: string
  prependIcon?: string
  appendIcon?: string
  closable?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'default',
  variant: 'glass',
  closable: false,
  disabled: false,
})

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
  (e: 'click:close', event: MouseEvent): void
}>()

const attrs = useAttrs()

const clickable = computed(() => 'onClick' in attrs || props.variant !== 'glass')

const hasGlassEffect = computed(
  () => props.variant === 'glass' || props.variant === 'tinted' || props.variant === 'solid',
)

const SIZE_MAP = {
  'x-small': { height: 20, padding: '0 6px', fontSize: '0.625rem', icon: 12, closeIcon: 12 },
  small: { height: 24, padding: '0 8px', fontSize: '0.75rem', icon: 14, closeIcon: 14 },
  default: { height: 28, padding: '0 10px', fontSize: '0.8125rem', icon: 16, closeIcon: 16 },
  large: { height: 32, padding: '0 12px', fontSize: '0.875rem', icon: 18, closeIcon: 18 },
}

const COLOR_MAP: Record<string, string> = {
  primary: '59, 130, 246',
  secondary: '139, 92, 246',
  success: '34, 197, 94',
  error: '239, 68, 68',
  warning: '245, 158, 11',
  info: '14, 165, 233',
}

const computedSizes = computed(() => SIZE_MAP[props.size])
const iconSize = computed(() => computedSizes.value.icon)
const closeIconSize = computed(() => computedSizes.value.closeIcon)

const chipClasses = computed(() => [
  `liquid-chip--${props.variant}`,
  `liquid-chip--${props.size}`,
  {
    'liquid-chip--clickable': clickable.value,
    'liquid-chip--disabled': props.disabled,
  },
])

const chipStyle = computed(() => ({
  minHeight: `${computedSizes.value.height}px`,
  padding: computedSizes.value.padding,
  fontSize: computedSizes.value.fontSize,
}))

const tintStyle = computed(() => {
  if (!props.color) return {}

  const rgb = COLOR_MAP[props.color] || '255, 255, 255'

  if (props.variant === 'solid') {
    return { background: `rgba(${rgb}, 0.55)` }
  }

  if (props.variant === 'tinted') {
    return { background: `rgba(${rgb}, 0.2)` }
  }

  return {}
})

const shineStyle = computed(() => {
  if (props.variant !== 'solid' || !props.color) return {}

  const rgb = COLOR_MAP[props.color] || '255, 255, 255'

  return {
    boxShadow: `
      inset 0 0 0 0.5px rgba(255, 255, 255, 0.4),
      inset 0 1px 2px 0 rgba(255, 255, 255, 0.25),
      inset 0 -1px 2px 0 rgba(0, 0, 0, 0.1),
      0 1px 4px 0 rgba(${rgb}, 0.3),
      0 2px 8px 0 rgba(${rgb}, 0.2)
    `.trim(),
  }
})

const handleClick = (event: MouseEvent) => {
  if (props.disabled) return
  emit('click', event)
}

const handleClose = (event: MouseEvent) => {
  if (props.disabled) return
  emit('click:close', event)
}
</script>

<style scoped lang="scss">
@use '../styles' as liquid;

.liquid-chip {
  border: none;
  border-radius: 9999px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  overflow: hidden;
  transition:
    transform 0.15s ease,
    opacity 0.15s ease,
    box-shadow 0.15s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;

  &--clickable {
    cursor: pointer;

    &:hover:not(.liquid-chip--disabled) {
      transform: scale(1.03);
    }

    &:active:not(.liquid-chip--disabled) {
      transform: scale(0.97);
    }
  }

  &--disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  // Variants
  &--glass,
  &--tinted,
  &--solid {
    background: transparent;
  }

  &--outlined {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.25);

    &:hover:not(.liquid-chip--disabled) {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.4);
    }
  }
}

// Glass Effect Layers
.liquid-chip__glass-effect {
  position: absolute;
  inset: 0;
  z-index: 0;
  @include liquid.liquid-glass-backdrop(16px, 180%);
}

.liquid-chip__glass-tint {
  position: absolute;
  inset: 0;
  z-index: 1;
  @include liquid.liquid-glass-tint(rgba(100, 100, 100, 0.15));
}

.liquid-chip__glass-shine {
  position: absolute;
  inset: 0;
  z-index: 2;
  box-shadow:
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.3),
    inset 0 1px 2px 0 rgba(255, 255, 255, 0.15),
    inset 0 -1px 2px 0 rgba(0, 0, 0, 0.06),
    0 1px 4px 0 rgba(0, 0, 0, 0.1);
  pointer-events: none;

  .liquid-chip--clickable:hover:not(.liquid-chip--disabled) & {
    box-shadow:
      inset 0 0 0 0.5px rgba(255, 255, 255, 0.45),
      inset 0 1px 3px 0 rgba(255, 255, 255, 0.25),
      inset 0 -1px 2px 0 rgba(0, 0, 0, 0.08),
      0 2px 8px 0 rgba(0, 0, 0, 0.15);
  }
}

.liquid-chip__content {
  position: relative;
  z-index: 3;
}

.liquid-chip__label {
  line-height: 1.2;
  white-space: nowrap;
}

.liquid-chip__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  border-radius: 50%;
  opacity: 0.7;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 1;
  }
}
</style>
