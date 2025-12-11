<template>
  <v-container fluid class="pa-0">
    <v-row no-gutters>
      <!-- Timer/Stopwatch Layout -->
      <v-col
        :cols="mdAndUp ? 6 : 12"
        :class="['pl-4 pt-4 pb-4', mdAndUp ? 'pr-2 mb-0' : 'pr-4 mb-4']"
        :style="{ height: `${leftCardHeight}px` }"
      >
        <v-card :style="{ height: `${leftCardHeight}px` }">
          <v-card-text>
            <v-row>
              <v-col cols="12" align="center">
                <v-btn-toggle
                  v-model="timerStore.settings.mode"
                  variant="outlined"
                  mandatory
                  class="mode-toggle"
                  @update:model-value="handleModeChange"
                >
                  <v-btn value="timer" min-width="110">
                    <v-icon
                      :icon="
                        stopwatchStore.stopwatchSettings.isStopwatchMode
                          ? 'mdi-timer-outline'
                          : 'mdi-timer'
                      "
                      class="mr-2"
                    ></v-icon>
                    {{
                      stopwatchStore.stopwatchSettings.isStopwatchMode
                        ? $t('timer.stopwatch')
                        : $t('timer.mode.timer')
                    }}
                  </v-btn>
                  <v-btn value="both" min-width="110">
                    <v-icon icon="mdi-view-split-horizontal" class="mr-2"></v-icon>
                    {{ $t('timer.mode.both') }}
                  </v-btn>
                  <v-btn value="clock" min-width="110" :disabled="timerStore.state !== 'stopped'">
                    <v-icon icon="mdi-clock" class="mr-2"></v-icon>
                    {{ $t('timer.mode.clock') }}
                  </v-btn>
                </v-btn-toggle>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12">
                <template v-if="!stopwatchStore.stopwatchSettings.isStopwatchMode">
                  <CountdownTimer
                    :progress="timerStore.progress"
                    :timer-formatted-time="timerStore.formattedTime"
                    :size="250"
                    :display-text="timerStore.isRunning"
                    class="mb-7"
                  >
                    <template #content>
                      <div
                        v-if="timerStore.state === 'stopped'"
                        class="d-flex justify-center align-center"
                      >
                        <v-text-field
                          v-model="timerStore.inputMinutes"
                          variant="plain"
                          density="compact"
                          hide-details
                          class="time-input-field"
                          placeholder="00"
                          @focus="handleFocus($event)"
                          @blur="handleBlur()"
                        ></v-text-field>
                        <span class="time-separator">:</span>
                        <v-text-field
                          v-model="timerStore.inputSeconds"
                          variant="plain"
                          density="compact"
                          hide-details
                          class="time-input-field"
                          placeholder="00"
                          @focus="handleFocus($event)"
                          @blur="handleBlur()"
                        ></v-text-field>
                      </div>
                      <span v-else>{{ timerStore.formattedTime }}</span>
                    </template>
                  </CountdownTimer>

                  <!-- Remove Time Buttons -->
                  <TimeAdjustmentButtons
                    type="remove"
                    :remaining-time="timerStore.settings.remainingTime"
                    @adjust="removeTime"
                  />

                  <!-- Add Time Buttons -->
                  <TimeAdjustmentButtons
                    type="add"
                    :remaining-time="timerStore.settings.remainingTime"
                    :is-finished="timerStore.isFinished"
                    @adjust="addTime"
                  />
                </template>
                <div
                  v-else
                  class="d-flex justify-center align-center fill-height"
                  style="height: 350px"
                >
                  <Stopwatch :size="250" />
                </div>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="6" class="d-flex justify-end">
                <v-btn
                  v-if="controlState === 'stopped'"
                  icon="mdi-play"
                  color="primary"
                  variant="flat"
                  :disabled="timerStore.settings.mode === 'clock'"
                  @click="startTimer"
                ></v-btn>
                <v-btn
                  v-if="controlState === 'running'"
                  icon="mdi-pause"
                  color="warning"
                  variant="flat"
                  :disabled="timerStore.settings.mode === 'clock'"
                  @click="pauseTimer"
                ></v-btn>
                <v-btn
                  v-if="controlState === 'paused'"
                  icon="mdi-play"
                  color="warning"
                  variant="flat"
                  :disabled="timerStore.settings.mode === 'clock'"
                  @click="resumeTimer"
                ></v-btn>
              </v-col>
              <v-col cols="6" class="d-flex justify-start">
                <v-btn
                  icon="mdi-refresh"
                  color="grey"
                  variant="outlined"
                  :disabled="timerStore.settings.mode === 'clock'"
                  @click="resetTimer"
                ></v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col :cols="mdAndUp ? 6 : 12" :class="['pt-4 pb-4 pr-4', mdAndUp ? 'pl-2' : 'pl-4']">
        <v-row no-gutters class="fill-height">
          <!-- Presets Layout -->
          <v-col cols="12" class="mb-4" :style="{ height: `${rightTopCardHeight}px` }">
            <v-card :style="{ height: `${rightTopCardHeight}px` }">
              <v-card-text>
                <div class="d-flex justify-space-between mb-2">
                  <v-label class="text-h6 align-start">{{ $t('timer.presets') }}</v-label>
                  <v-btn
                    icon="mdi-plus"
                    size="small"
                    variant="tonal"
                    :disabled="timerStore.state !== 'stopped'"
                    :class="{ 'cursor-not-allowed': timerStore.state !== 'stopped' }"
                    @click="saveTimerPreset"
                  ></v-btn>
                </div>
                <v-list density="compact">
                  <v-list-item v-for="item in timerStore.presets" :key="item.id" class="px-0">
                    <template #prepend>
                      <v-icon icon="mdi-history"></v-icon>
                    </template>

                    <v-list-item-title class="text-h6">
                      {{ formatDuration(item.duration) }}
                    </v-list-item-title>

                    <template #append>
                      <v-btn
                        icon="mdi-play"
                        size="small"
                        variant="text"
                        @click="applyPreset(item)"
                      ></v-btn>
                      <v-btn
                        icon="mdi-delete"
                        size="small"
                        variant="text"
                        @click="deletePreset(item.id)"
                      ></v-btn>
                    </template>
                  </v-list-item>
                </v-list>
              </v-card-text>
            </v-card>
          </v-col>

          <!-- Control Layout -->
          <v-col cols="12" :style="{ height: `${rightBottomCardHeight}px` }">
            <v-card :style="{ height: `${rightBottomCardHeight}px` }">
              <v-card-text>
                <v-label class="text-h6 align-start mb-2">{{ $t('control') }}</v-label>
                <div class="d-flex align-center fill-height">
                  <v-switch
                    v-model="stopwatchStore.stopwatchSettings.isStopwatchMode"
                    :label="$t('timer.stopwatch')"
                    color="primary"
                    hide-details
                    :disabled="
                      timerStore.state !== 'stopped' || stopwatchStore.stopwatchSettings.isRunning
                    "
                  ></v-switch>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, onUnmounted, nextTick } from 'vue'
import { useDisplay } from 'vuetify'
import { useI18n } from 'vue-i18n'
import { useTimerStore } from '@/stores/timer'
import { useStopwatchStore } from '@/stores/stopwatch'
import { useProjectionStore } from '@/stores/projection'
import { useElectron } from '@/composables/useElectron'
import { useProjectionMessaging } from '@/composables/useProjectionMessaging'
import { APP_CONFIG } from '@/config/app'
import { TimerMode, ViewType } from '@/types/common'
import CountdownTimer from '@/components/Timer/CountdownTimer.vue'
import Stopwatch from '@/components/Timer/StopWatcher.vue'
import TimeAdjustmentButtons from '@/components/Timer/TimeAdjustmentButtons.vue'
import { useMemoryManager } from '@/utils/memoryManager'
import { useSnackBar } from '@/composables/useSnackBar'
import { useCardLayout } from '@/composables/useLayout'

const timerStore = useTimerStore()
const stopwatchStore = useStopwatchStore()
const projectionStore = useProjectionStore()
const { t: $t } = useI18n()

const { showSnackBar } = useSnackBar()

const { isElectron } = useElectron()

const { setProjectionState, syncAllStates, cleanupResources } = useProjectionMessaging()

const { cleanup } = useMemoryManager('TimerControl')

const { leftCardHeight, rightTopCardHeight, rightBottomCardHeight } = useCardLayout({
  minHeight: APP_CONFIG.UI.MIN_CARD_HEIGHT,
  topCardRatio: 0.6, // 60% 上，40% 下
})

const controlState = computed(() => {
  if (stopwatchStore.stopwatchSettings.isStopwatchMode) {
    if (stopwatchStore.stopwatchSettings.isRunning) return 'running'
    if (stopwatchStore.stopwatchSettings.elapsedTime > 0) return 'paused'
    return 'stopped'
  }
  return timerStore.state
})

const { mdAndUp } = useDisplay()

const handleFocus = (event: FocusEvent) => {
  const target = event.target as HTMLInputElement
  if (target) {
    nextTick(() => {
      target.select()
    })
  }
}

const handleBlur = () => {
  if (!/^\d*$/.test(timerStore.inputMinutes) || !/^\d*$/.test(timerStore.inputSeconds)) {
    showSnackBar('Only numbers are allowed', 'error', 3000)
  }
}

const addTime = (secondsToAdd: number) => {
  timerStore.addTime(secondsToAdd)
}

const removeTime = (secondsToRemove: number) => {
  timerStore.removeTime(secondsToRemove)
}

const handleModeChange = (mode: TimerMode) => {
  timerStore.setMode(mode)
}

const startTimer = async () => {
  if (stopwatchStore.stopwatchSettings.isStopwatchMode) {
    stopwatchStore.startStopwatch()
  } else {
    timerStore.startTimer()
    await updateProjectionState()
  }
}

const pauseTimer = () => {
  if (stopwatchStore.stopwatchSettings.isStopwatchMode) {
    stopwatchStore.pauseStopwatch()
  } else {
    timerStore.pauseTimer()
  }
}

const resetTimer = () => {
  if (stopwatchStore.stopwatchSettings.isStopwatchMode) {
    stopwatchStore.resetStopwatch()
  } else {
    timerStore.resetTimer()
  }
}

const resumeTimer = async () => {
  if (stopwatchStore.stopwatchSettings.isStopwatchMode) {
    stopwatchStore.startStopwatch()
  } else {
    timerStore.resumeTimer()
    await updateProjectionState()
  }
}

// updateProjectionState logic remains the same
const updateProjectionState = async () => {
  if (isElectron()) {
    if (projectionStore.isShowingDefault || projectionStore.currentView !== 'timer') {
      await setProjectionState(false, ViewType.TIMER)
    }
  }
}

// Simplified method: just calls store action
const applyPreset = (item: { id: string; duration: number }) => {
  timerStore.applyPreset(item)
}

// Simplified method: just calls store action
const deletePreset = (id: string) => {
  timerStore.deletePreset(id)
}

// Simplified method: store already knows the duration
const saveTimerPreset = () => {
  timerStore.addToPresets(timerStore.settings.originalDuration)
}

// formatDuration logic remains the same
const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

onMounted(() => {
  syncAllStates()
})

onBeforeUnmount(() => {
  cleanupResources()
})

onUnmounted(() => {
  cleanup()
})
</script>

<style scoped>
.preset-card {
  height: 335px;
}

.external-card {
  height: 250px;
}

.time-input-field {
  width: 90px;
}

.time-separator {
  font-size: 77px;
  font-weight: 500;
}

.time-input-field :deep(.v-field__input) {
  text-align: center;
  font-size: 77px;
  font-weight: 500;
  padding: 0;
  min-height: auto;
  transition: all 0.2s ease;
}

.time-input-field :deep(.v-field__input::placeholder) {
  color: rgba(var(--v-theme-on-surface), 0.4);
  font-size: 77px;
  font-weight: 500;
}

.time-input-field:focus-within :deep(.v-field__input) {
  background-color: rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 8px;
}

.time-button {
  min-width: 80px;
  width: 80px;
}
</style>
