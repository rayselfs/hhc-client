<template>
  <v-row :class="rowClass">
    <v-col cols="12" align="center" :class="colClass">
      <v-btn
        v-for="seconds in adjustments"
        :key="seconds"
        class="mr-2 ml-2 time-button"
        :color="color"
        variant="outlined"
        :disabled="isDisabled(seconds)"
        @click="$emit('adjust', seconds)"
      >
        {{ getLabel(seconds) }}
      </v-btn>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  type: 'add' | 'remove'
  remainingTime?: number
  rowClass?: string
  colClass?: string
  isFinished?: boolean // Timer finished but not reset
}

const props = defineProps<Props>()

defineEmits<{
  (e: 'adjust', seconds: number): void
}>()

const adjustments = [10, 30, 60]

const color = computed(() => (props.type === 'add' ? 'primary' : 'orange'))

const getLabel = (seconds: number) => {
  const prefix = props.type === 'add' ? '+' : '-'
  const time = seconds === 60 ? '1:00' : `0:${seconds}`
  return `${prefix}${time}`
}

const isDisabled = (seconds: number) => {
  // Disable add buttons when timer is finished but not reset
  if (props.type === 'add' && props.isFinished) {
    return true
  }

  if (props.type === 'add') {
    return (props.remainingTime || 0) + seconds >= 3600
  } else {
    return (props.remainingTime || 0) <= seconds
  }
}
</script>

<style scoped>
.time-button {
  min-width: 80px;
  width: 80px;
}
</style>
