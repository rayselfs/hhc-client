<template>
  <hr class="liquid-divider" :class="dividerClasses" :style="dividerStyle" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  vertical?: boolean
  inset?: boolean
  thickness?: number
}

const props = withDefaults(defineProps<Props>(), {
  vertical: false,
  inset: false,
  thickness: 1,
})

const dividerClasses = computed(() => ({
  'liquid-divider--vertical': props.vertical,
  'liquid-divider--inset': props.inset,
}))

const dividerStyle = computed(() => {
  if (props.vertical) {
    return { width: `${props.thickness}px` }
  }
  return { height: `${props.thickness}px` }
})
</script>

<style scoped lang="scss">
.liquid-divider {
  display: block;
  flex: 1 1 0;
  border: none;
  margin: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(var(--hhc-glass-border), var(--hhc-glass-border-opacity)) 20%,
    rgba(var(--hhc-glass-border), var(--hhc-glass-border-opacity)) 80%,
    transparent 100%
  );

  &:not(&--vertical) {
    width: 100%;
    min-width: 100%;
    max-height: 1px;
  }

  &--vertical {
    align-self: stretch;
    min-height: 100%;
    max-width: 1px;
    background: linear-gradient(
      180deg,
      transparent 0%,
      rgba(var(--hhc-glass-border), var(--hhc-glass-border-opacity)) 20%,
      rgba(var(--hhc-glass-border), var(--hhc-glass-border-opacity)) 80%,
      transparent 100%
    );
  }

  &--inset:not(&--vertical) {
    margin-left: 16px;
    margin-right: 16px;
    width: calc(100% - 32px);
    min-width: calc(100% - 32px);
  }

  &--inset#{&}--vertical {
    margin-top: 8px;
    margin-bottom: 8px;
    min-height: calc(100% - 16px);
  }
}
</style>
