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
      <LiquidIcon
        v-if="prependIcon"
        :icon="prependIcon"
        :size="iconSize"
        class="liquid-chip__prepend mr-1"
      />

      <!-- Label -->
      <span class="liquid-chip__label">
        <slot>{{ label }}</slot>
      </span>

      <!-- Append icon -->
      <LiquidIcon
        v-if="appendIcon"
        :icon="appendIcon"
        :size="iconSize"
        class="liquid-chip__append ml-1"
      />

      <!-- Close button -->
      <button
        v-if="closable"
        type="button"
        class="liquid-chip__close ml-1"
        @click.stop="handleClose"
      >
        <LiquidIcon icon="mdi-close" :size="closeIconSize" />
      </button>
    </span>
  </component>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { useLiquidGlassFilters } from '../composables/useLiquidGlassFilters'
import { getThemeColorVar, isThemeColor, getChipSizeConfig, isSizeKey, type SizeKey } from '../constants'
import LiquidIcon from '../LiquidIcon/LiquidIcon.vue'

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

// Helper to get color variable
const getColorVar = (color: string | undefined): string => {
  if (!color) return 'var(--hhc-glass-tint)'
  if (isThemeColor(color)) return getThemeColorVar(color)
  return color
}

const computedSizes = computed(() => {
  const sizeKey: SizeKey = props.size && isSizeKey(props.size) ? props.size : 'default'
  const config = getChipSizeConfig(sizeKey)
  return {
    height: config.height,
    padding: `0 ${config.paddingX}px`,
    fontSize: config.fontSize,
    icon: config.icon,
    closeIcon: config.icon, // Use same as icon for consistency
  }
})
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

  const colorVar = getColorVar(props.color)

  if (props.variant === 'solid') {
    return { background: `rgba(${colorVar}, var(--hhc-btn-solid-opacity))` }
  }

  if (props.variant === 'tinted') {
    return { background: `rgba(${colorVar}, var(--hhc-btn-tinted-opacity))` }
  }

  return {}
})

const shineStyle = computed(() => {
  if (props.variant !== 'solid' || !props.color) return {}

  const colorVar = getColorVar(props.color)

  return {
    boxShadow: `
      inset 0 0 0 0.5px rgba(var(--hhc-glass-shine-top), 0.4),
      inset 0 1px 2px 0 rgba(var(--hhc-glass-shine-top), 0.25),
      inset 0 -1px 2px 0 rgba(var(--hhc-glass-shine-bottom), 0.1),
      0 1px 4px 0 rgba(${colorVar}, 0.3),
      0 2px 8px 0 rgba(${colorVar}, 0.2)
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
  border-radius: var(--hhc-radius-pill);
  font-weight: 500;
  color: rgba(var(--hhc-glass-text), var(--hhc-glass-text-opacity));
  overflow: hidden;
  transition:
    transform var(--hhc-transition-fast) var(--hhc-transition-easing),
    opacity var(--hhc-transition-fast) var(--hhc-transition-easing),
    box-shadow var(--hhc-transition-fast) var(--hhc-transition-easing);
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
    @include liquid.liquid-disabled;
  }

  // Variants
  &--glass,
  &--tinted,
  &--solid {
    background: transparent;
  }

  &--outlined {
    background: rgba(var(--hhc-glass-tint), 0.05);
    border: 1px solid rgba(var(--hhc-glass-border), var(--hhc-glass-border-opacity));

    &:hover:not(.liquid-chip--disabled) {
      background: rgba(var(--hhc-glass-tint), 0.1);
      border-color: rgba(var(--hhc-glass-border), var(--hhc-glass-border-hover-opacity));
    }
  }
}

// Glass Effect Layers
.liquid-chip__glass-effect {
  position: absolute;
  inset: 0;
  z-index: 0;
  @include liquid.liquid-glass-backdrop(var(--hhc-blur-lg), 180%);
}

.liquid-chip__glass-tint {
  position: absolute;
  inset: 0;
  z-index: 1;
  @include liquid.liquid-glass-tint;
}

.liquid-chip__glass-shine {
  position: absolute;
  inset: 0;
  z-index: 2;
  box-shadow:
    inset 0 0 0 0.5px rgba(var(--hhc-glass-border), 0.3),
    inset 0 1px 2px 0 rgba(var(--hhc-glass-shine-top), 0.15),
    inset 0 -1px 2px 0 rgba(var(--hhc-glass-shine-bottom), 0.06),
    0 1px 4px 0 rgba(var(--hhc-glass-shadow-color), 0.1);
  pointer-events: none;

  .liquid-chip--clickable:hover:not(.liquid-chip--disabled) & {
    box-shadow:
      inset 0 0 0 0.5px rgba(var(--hhc-glass-border), 0.45),
      inset 0 1px 3px 0 rgba(var(--hhc-glass-shine-top), 0.25),
      inset 0 -1px 2px 0 rgba(var(--hhc-glass-shine-bottom), 0.08),
      0 2px 8px 0 rgba(var(--hhc-glass-shadow-color), 0.15);
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
  transition: opacity var(--hhc-transition-fast) var(--hhc-transition-easing);

  &:hover {
    opacity: 1;
  }
}
</style>
