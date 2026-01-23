<template>
  <div class="liquid-card-actions" :class="alignClass">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  align?: 'start' | 'center' | 'end'
}

const props = withDefaults(defineProps<Props>(), {
  align: 'end',
})

const alignClass = computed(() => `liquid-card-actions--${props.align}`)
</script>

<style scoped lang="scss">
.liquid-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 8px 8px 8px;
  min-height: 52px;
}

.liquid-card-actions--start {
  justify-content: flex-start;
}

.liquid-card-actions--center {
  justify-content: center;
}

.liquid-card-actions--end {
  justify-content: flex-end;
}
</style>
