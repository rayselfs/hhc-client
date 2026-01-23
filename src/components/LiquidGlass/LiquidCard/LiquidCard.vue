<template>
  <LiquidContainer
    class="liquid-card"
    :class="[elevationClass]"
    :rounded="rounded"
    :padding="padding"
    :mode="mode"
  >
    <div class="liquid-card__content">
      <slot></slot>
    </div>
  </LiquidContainer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { LiquidContainer } from '../LiquidContainer'

interface Props {
  rounded?: string
  padding?: string
  mode?: 'advanced' | 'simple' | 'refraction' | 'ghost'
  elevation?: 0 | 1 | 2 | 3
}

const props = withDefaults(defineProps<Props>(), {
  rounded: 'rounded-lg',
  padding: 'pa-0',
  mode: 'simple',
  elevation: 1,
})

const elevationClass = computed(() => `liquid-card--elevation-${props.elevation}`)
</script>

<style scoped lang="scss">
.liquid-card {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.liquid-card__content {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  width: 100%;
}

.liquid-card--elevation-0 {
  box-shadow: none !important;
}

.liquid-card--elevation-1 {
  box-shadow:
    0 2px 4px -1px rgba(0, 0, 0, 0.2),
    0 4px 5px 0 rgba(0, 0, 0, 0.14),
    0 1px 10px 0 rgba(0, 0, 0, 0.12) !important;
}

.liquid-card--elevation-2 {
  box-shadow:
    0 3px 5px -1px rgba(0, 0, 0, 0.2),
    0 6px 10px 0 rgba(0, 0, 0, 0.14),
    0 1px 18px 0 rgba(0, 0, 0, 0.12) !important;
}

.liquid-card--elevation-3 {
  box-shadow:
    0 5px 5px -3px rgba(0, 0, 0, 0.2),
    0 8px 10px 1px rgba(0, 0, 0, 0.14),
    0 3px 14px 2px rgba(0, 0, 0, 0.12) !important;
}
</style>
