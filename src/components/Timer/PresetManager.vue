<template>
  <v-card :style="{ height: `${height}px` }" rounded="lg">
    <v-card-text>
      <div class="d-flex justify-space-between mb-2">
        <v-label class="text-h6 align-start">{{ $t('timer.presets') }}</v-label>
        <liquid-btn
          icon="mdi-plus"
          :disabled="timerStore.state !== 'stopped' || stopwatchStore.global.isStopwatchMode"
          :class="{ 'cursor-not-allowed': timerStore.state !== 'stopped' }"
          @click="saveTimerPreset"
        />
      </div>
      <v-list density="compact">
        <v-list-item
          v-for="item in timerStore.presets"
          :key="item.id"
          rounded="rounded-lg"
          padding="pa-2"
          :hover-opacity="0.2"
          @click="applyPreset(item)"
        >
          <template #prepend>
            <v-icon icon="mdi-history"></v-icon>
          </template>

          <span class="text-h6">{{ formatDuration(item.duration) }}</span>

          <template #append>
            <v-btn
              icon="mdi-delete"
              size="small"
              variant="text"
              @click.stop="deletePreset(item.id)"
            ></v-btn>
          </template>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { useTimerStore } from '@/stores/timer'
import { useStopwatchStore } from '@/stores/stopwatch'
import { formatDuration } from '@/utils/time'

interface Props {
  height?: number | string
}

withDefaults(defineProps<Props>(), {
  height: 'auto',
})

const timerStore = useTimerStore()
const stopwatchStore = useStopwatchStore()

const applyPreset = (item: { id: string; duration: number }) => {
  timerStore.applyPreset(item)
}

const deletePreset = (id: string) => {
  timerStore.deletePreset(id)
}

const saveTimerPreset = () => {
  timerStore.addToPresets(timerStore.settings.originalDuration)
}
</script>
