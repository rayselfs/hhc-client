<template>
  <v-container fluid class="pa-0">
    <v-row no-gutters>
      <!-- Timer/Stopwatch Layout -->
      <v-col
        :cols="mdAndUp ? 6 : 12"
        :class="['pl-4 pt-4 pb-4', mdAndUp ? 'pr-2 mb-0' : 'pr-4 mb-4']"
        :style="{ height: `${leftCardHeight}px` }"
      >
        <v-card :style="{ height: `${leftCardHeight}px` }" rounded="lg">
          <v-card-text class="d-flex flex-column h-100">
            <v-row class="flex-grow-0">
              <v-col cols="12" align="center">
                <liquid-btn-toggle
                  v-model="timerStore.settings.mode"
                  :items="toggleItems"
                  mandatory
                  density="default"
                  mode="simple"
                  rounded="rounded-xl"
                  size="large"
                  @update:model-value="handleModeChange"
                />
              </v-col>
            </v-row>

            <v-row class="flex-grow-1 align-center">
              <v-col cols="12">
                <TimerDisplay :size="250" />
              </v-col>
            </v-row>

            <!-- Control Buttons -->
            <v-row class="mt-auto mb-2 flex-grow-0">
              <v-col cols="6" class="d-flex justify-end">
                <liquid-btn
                  v-bind="mainControlConfig"
                  size="x-large"
                  variant="solid"
                  :disabled="areControlsDisabled"
                />
              </v-col>
              <v-col cols="6" class="d-flex justify-start">
                <liquid-btn
                  icon="mdi-refresh"
                  size="x-large"
                  :disabled="areControlsDisabled"
                  :title="
                    stopwatchStore.global.isStopwatchMode
                      ? $t('timer.resetStopwatch')
                      : $t('timer.resetCountdown')
                  "
                  @click="resetTimer"
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col :cols="mdAndUp ? 6 : 12" :class="['pt-4 pb-4 pr-4', mdAndUp ? 'pl-2' : 'pl-4']">
        <v-row no-gutters class="fill-height">
          <!-- Presets Layout -->
          <v-col cols="12" class="mb-4" :style="{ height: `${rightTopCardHeight}px` }">
            <PresetManager :height="rightTopCardHeight" />
          </v-col>

          <!-- Control Layout -->
          <v-col cols="12" :style="{ height: `${rightBottomCardHeight}px` }">
            <TimerSettings :height="rightBottomCardHeight" />
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, onUnmounted } from 'vue'
import { useDisplay } from 'vuetify'
import { useI18n } from 'vue-i18n'
import { useTimerStore } from '@/stores/timer'
import { useStopwatchStore } from '@/stores/stopwatch'
import { useProjectionStore } from '@/stores/projection'
import { useElectron } from '@/composables/useElectron'
import { useProjectionManager } from '@/composables/useProjectionManager'
import { APP_CONFIG } from '@/config/app'

import { ViewType } from '@/types/projection'
import { TimerMode } from '@/types/timer'
import TimerDisplay from '@/components/Timer/TimerDisplay.vue'
import PresetManager from '@/components/Timer/PresetManager.vue'
import TimerSettings from '@/components/Timer/TimerSettings.vue'
import { useMemoryManager } from '@/utils/memoryManager'
import { useCardLayout } from '@/composables/useLayout'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { KEYBOARD_SHORTCUTS } from '@/config/shortcuts'

const timerStore = useTimerStore()
const stopwatchStore = useStopwatchStore()
const projectionStore = useProjectionStore()
const { t: $t } = useI18n()

const { isElectron } = useElectron()
const { setProjectionState, cleanupResources } = useProjectionManager()
const { cleanup } = useMemoryManager('TimerControl')

const handleToggle = () => {
  switch (timerStore.state) {
    case 'running':
      pauseTimer()
      break
    case 'paused':
      resumeTimer()
      break
    case 'stopped':
      startTimer()
      break
  }
}

const handleReset = () => {
  timerStore.resetTimer()
}

useKeyboardShortcuts([
  { config: KEYBOARD_SHORTCUTS.TIMER.TOGGLE, handler: handleToggle },
  { config: KEYBOARD_SHORTCUTS.TIMER.RESET, handler: handleReset },
])

const { leftCardHeight, rightTopCardHeight, rightBottomCardHeight } = useCardLayout({
  minHeight: APP_CONFIG.UI.MIN_CARD_HEIGHT,
  topCardRatio: 0.6,
})

const toggleItems = computed(() => [
  { value: 'timer', icon: 'mdi-timer', label: $t('timer.mode.timer') },
  { value: 'both', icon: 'mdi-view-split-horizontal', label: $t('timer.mode.both') },
  {
    value: 'clock',
    icon: 'mdi-clock',
    label: $t('timer.mode.clock'),
    disabled: !stopwatchStore.global.isStopwatchMode && timerStore.state !== 'stopped',
  },
])

const controlState = computed(() => {
  if (stopwatchStore.global.isStopwatchMode) {
    if (stopwatchStore.global.isRunning) return 'running'
    if (stopwatchStore.global.elapsedTime > 0) return 'paused'
    return 'stopped'
  }
  return timerStore.state
})

const areControlsDisabled = computed(() => {
  return !stopwatchStore.global.isStopwatchMode && timerStore.settings.mode === 'clock'
})

const { mdAndUp } = useDisplay()

const handleModeChange = (mode: TimerMode) => {
  timerStore.setMode(mode)
}

const startTimer = async () => {
  if (stopwatchStore.global.isStopwatchMode) {
    stopwatchStore.startGlobal()
  } else {
    timerStore.startTimer()
    await updateProjectionState()
  }
}

const pauseTimer = () => {
  if (stopwatchStore.global.isStopwatchMode) {
    stopwatchStore.pauseGlobal()
  } else {
    timerStore.pauseTimer()
  }
}

const resetTimer = () => {
  if (stopwatchStore.global.isStopwatchMode) {
    stopwatchStore.resetGlobal()
  } else {
    timerStore.resetTimer()
  }
}

const resumeTimer = async () => {
  if (stopwatchStore.global.isStopwatchMode) {
    stopwatchStore.startGlobal()
  } else {
    timerStore.resumeTimer()
    await updateProjectionState()
  }
}

const mainControlConfig = computed(() => {
  const isStopwatch = stopwatchStore.global.isStopwatchMode

  switch (controlState.value) {
    case 'running':
      return {
        icon: 'mdi-pause',
        color: 'warning',
        title: isStopwatch ? $t('timer.pauseStopwatch') : $t('timer.pauseCountdown'),
        onClick: pauseTimer,
      }
    case 'paused':
      return {
        icon: 'mdi-play',
        color: 'warning',
        title: isStopwatch ? $t('timer.resumeStopwatch') : $t('timer.resumeCountdown'),
        onClick: resumeTimer,
      }
    case 'stopped':
    default:
      return {
        icon: 'mdi-play',
        color: 'primary',
        title: isStopwatch ? $t('timer.startStopwatch') : $t('timer.startCountdown'),
        onClick: startTimer,
      }
  }
})

const updateProjectionState = async () => {
  if (isElectron()) {
    if (projectionStore.isShowingDefault || projectionStore.currentView !== 'timer') {
      await setProjectionState(false, ViewType.TIMER)
    }
  }
}

onMounted(() => {
  if (isElectron()) {
    if (!projectionStore.isShowingDefault) {
      setProjectionState(false, ViewType.TIMER)
    }
  }
})

onBeforeUnmount(() => {
  cleanupResources()
})

onUnmounted(() => {
  cleanup()
})
</script>

<style scoped>
.v-btn-toggle .v-btn--active :deep(.v-btn__overlay) {
  /* Override: Remove active button overlay to match custom toggle styling */
  opacity: 0 !important;
}
</style>
