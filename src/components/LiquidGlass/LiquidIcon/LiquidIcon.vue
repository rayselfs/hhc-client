<template>
  <span class="liquid-icon" :class="iconClass" :style="iconStyle"></span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  /** Icon name, e.g., 'mdi-close' */
  icon: string
  /** Size in pixels or CSS value */
  size?: number | string
  /** Color (CSS color value) */
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 24,
})

const iconClass = computed(() => {
  const icon = props.icon
  // Support mdi-* format (Material Design Icons)
  if (icon.startsWith('mdi-')) {
    return `mdi ${icon}`
  }
  // Support other icon fonts
  return icon
})

const iconStyle = computed(() => {
  const size = typeof props.size === 'number' ? `${props.size}px` : props.size
  return {
    fontSize: size,
    width: size,
    height: size,
    color: props.color,
  }
})
</script>

<style lang="scss" scoped>
.liquid-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  flex-shrink: 0;

  // Inherit color from parent if not specified
  &:not([style*='color']) {
    color: inherit;
  }
}
</style>
