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
          <v-card-text class="d-flex flex-column h-100">
            <v-row class="flex-grow-0">
              <v-col cols="12" align="center">
                <v-btn-toggle
                  v-model="timerStore.settings.mode"
                  variant="elevated"
                  mandatory
                  color="primary"
                  border
                  @update:model-value="handleModeChange"
                >
                  <v-btn value="timer" min-width="110">
                    <v-icon icon="mdi-timer" class="mr-2"></v-icon>
                    {{ $t('timer.mode.timer') }}
                  </v-btn>
                  <v-btn value="both" min-width="110">
                    <v-icon icon="mdi-view-split-horizontal" class="mr-2"></v-icon>
                    {{ $t('timer.mode.both') }}
                  </v-btn>
                  <v-btn
                    value="clock"
                    min-width="110"
                    :disabled="
                      !stopwatchStore.global.isStopwatchMode && timerStore.state !== 'stopped'
                    "
                  >
                    <v-icon icon="mdi-clock" class="mr-2"></v-icon>
                    {{ $t('timer.mode.clock') }}
                  </v-btn>
                </v-btn-toggle>
              </v-col>
            </v-row>

            <v-row class="flex-grow-1 align-center">
              <v-col cols="12">
                <v-fade-transition mode="out-in">
                  <div
                    v-if="!stopwatchStore.global.isStopwatchMode"
                    key="timer"
                    class="d-flex flex-column align-center justify-center fill-height"
                  >
                    <CountdownTimer
                      :progress="timerStore.progress"
                      :timer-formatted-time="timerStore.formattedTime"
                      :size="250"
                      :display-text="timerStore.isRunning"
                      class="mb-8"
                    >
                      <template #content>
                        <div
                          v-if="timerStore.state === 'stopped'"
                          class="d-flex justify-center align-center"
                        >
                          <TimeInput
                            v-model="timerStore.inputMinutes"
                            :on-error="(msg) => showSnackBar(msg, 'error', 3000)"
                          />
                          <span class="time-separator">:</span>
                          <TimeInput
                            v-model="timerStore.inputSeconds"
                            :on-error="(msg) => showSnackBar(msg, 'error', 3000)"
                          />
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
                  </div>
                  <div
                    v-else
                    key="stopwatch"
                    class="d-flex justify-center align-center fill-height"
                  >
                    <Stopwatch :size="250" />
                  </div>
                </v-fade-transition>
              </v-col>
            </v-row>

            <!-- Control Buttons -->
            <v-row class="mt-auto mb-2 flex-grow-0">
              <v-col cols="6" class="d-flex justify-end">
                <v-btn
                  v-if="controlState === 'stopped'"
                  icon="mdi-play"
                  color="primary"
                  variant="flat"
                  :disabled="areControlsDisabled"
                  :title="
                    stopwatchStore.global.isStopwatchMode
                      ? $t('timer.startStopwatch')
                      : $t('timer.startCountdown')
                  "
                  @click="startTimer"
                ></v-btn>
                <v-btn
                  v-if="controlState === 'running'"
                  icon="mdi-pause"
                  color="warning"
                  variant="flat"
                  :disabled="areControlsDisabled"
                  :title="
                    stopwatchStore.global.isStopwatchMode
                      ? $t('timer.pauseStopwatch')
                      : $t('timer.pauseCountdown')
                  "
                  @click="pauseTimer"
                ></v-btn>
                <v-btn
                  v-if="controlState === 'paused'"
                  icon="mdi-play"
                  color="warning"
                  variant="flat"
                  :disabled="areControlsDisabled"
                  :title="
                    stopwatchStore.global.isStopwatchMode
                      ? $t('timer.resumeStopwatch')
                      : $t('timer.resumeCountdown')
                  "
                  @click="resumeTimer"
                ></v-btn>
              </v-col>
              <v-col cols="6" class="d-flex justify-start">
                <v-btn
                  icon="mdi-refresh"
                  color="grey"
                  variant="outlined"
                  :disabled="areControlsDisabled"
                  :title="
                    stopwatchStore.global.isStopwatchMode
                      ? $t('timer.resetStopwatch')
                      : $t('timer.resetCountdown')
                  "
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
                    :disabled="
                      timerStore.state !== 'stopped' || stopwatchStore.global.isStopwatchMode
                    "
                    :class="{ 'cursor-not-allowed': timerStore.state !== 'stopped' }"
                    @click="saveTimerPreset"
                  ></v-btn>
                </div>
                <v-list density="compact">
                  <v-list-item
                    v-for="item in timerStore.presets"
                    :key="item.id"
                    class="px-2 rounded preset-item"
                    @click="applyPreset(item)"
                    link
                  >
                    <template #prepend>
                      <v-icon icon="mdi-history"></v-icon>
                    </template>

                    <v-list-item-title class="text-h6">
                      {{ formatDuration(item.duration) }}
                    </v-list-item-title>

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
          </v-col>

          <!-- Control Layout -->
          <v-col cols="12" :style="{ height: `${rightBottomCardHeight}px` }">
            <v-card :style="{ height: `${rightBottomCardHeight}px` }">
              <v-card-text>
                <v-label class="text-h6 align-start mb-2">{{ $t('common.control') }}</v-label>
                <div class="d-flex align-center fill-height">
                  <v-switch
                    v-model="stopwatchStore.global.isStopwatchMode"
                    :label="$t('timer.stopwatch')"
                    color="primary"
                    hide-details
                  ></v-switch>
                </div>
                <div class="d-flex align-center mt-2">
                  <v-switch
                    v-model="reminderEnabled"
                    :label="$t('timer.reminder')"
                    color="primary"
                    hide-details
                    class="mr-4"
                  ></v-switch>
                  <v-text-field
                    v-model="reminderTimeInput"
                    type="number"
                    variant="outlined"
                    density="compact"
                    hide-details
                    style="max-width: 100px"
                    :suffix="$t('timer.reminderSecond')"
                    :disabled="timerStore.state !== 'stopped'"
                    @update:model-value="handleReminderTimeChange"
                  ></v-text-field>
                </div>
                <div class="d-flex align-center mt-2">
                  <v-switch
                    v-model="overtimeMessageEnabled"
                    :label="$t('timer.overtimeMessage')"
                    color="primary"
                    hide-details
                    class="mr-4"
                  ></v-switch>
                  <v-text-field
                    v-model="overtimeMessageInput"
                    variant="outlined"
                    density="compact"
                    hide-details
                    :label="$t('timer.overtimeMessageLabel')"
                    :disabled="timerStore.state !== 'stopped'"
                    :maxlength="TIMER_CONFIG.OVERTIME_MESSAGE.MAX_LENGTH"
                    style="max-width: 250px"
                    @blur="handleOvertimeMessageBlur"
                    @keyup.enter="handleOvertimeMessageEnter"
                  ></v-text-field>
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
import { computed, onMounted, onBeforeUnmount, onUnmounted } from 'vue'
import { useDisplay } from 'vuetify'
import { useI18n } from 'vue-i18n'
import { useTimerStore } from '@/stores/timer'
import { useStopwatchStore } from '@/stores/stopwatch'
import { useProjectionStore } from '@/stores/projection'
import { useElectron } from '@/composables/useElectron'
import { useProjectionManager } from '@/composables/useProjectionManager'
import { APP_CONFIG, TIMER_CONFIG } from '@/config/app'

import { TimerMode, ViewType } from '@/types/common'
import CountdownTimer from '@/components/Timer/CountdownTimer.vue'
import Stopwatch from '@/components/Timer/StopWatcher.vue'
import TimeAdjustmentButtons from '@/components/Timer/TimeAdjustmentButtons.vue'
import TimeInput from '@/components/Timer/TimeInput.vue'
import { useMemoryManager } from '@/utils/memoryManager'
import { useSnackBar } from '@/composables/useSnackBar'
import { useCardLayout } from '@/composables/useLayout'
import { formatDuration } from '@/utils/time'

const timerStore = useTimerStore()
const stopwatchStore = useStopwatchStore()
const projectionStore = useProjectionStore()
const { t: $t } = useI18n()

const { showSnackBar } = useSnackBar()
const { isElectron } = useElectron()
const { setProjectionState, cleanupResources } = useProjectionManager()
const { cleanup } = useMemoryManager('TimerControl')
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { KEYBOARD_SHORTCUTS } from '@/config/shortcuts'

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

// updateProjectionState logic remains the same
const updateProjectionState = async () => {
  if (isElectron()) {
    if (projectionStore.isShowingDefault || projectionStore.currentView !== 'timer') {
      await setProjectionState(false, ViewType.TIMER)
    }
  }
}

const applyPreset = (item: { id: string; duration: number }) => {
  timerStore.applyPreset(item)
}

const deletePreset = (id: string) => {
  timerStore.deletePreset(id)
}

const saveTimerPreset = () => {
  timerStore.addToPresets(timerStore.settings.originalDuration)
}

const reminderEnabled = computed({
  get: () => timerStore.settings.reminderEnabled,
  set: (value) => {
    timerStore.setReminder(value, timerStore.settings.reminderTime)
  },
})

const reminderTimeInput = computed({
  get: () => timerStore.settings.reminderTime,
  set: () => {},
})

const handleReminderTimeChange = (value: string) => {
  const seconds = parseInt(value)
  if (isNaN(seconds) || seconds < 0) {
    return
  }
  // Remove seconds * 60 conversion, use directly
  if (seconds >= timerStore.settings.originalDuration) {
    showSnackBar($t('timer.reminderError'), 'warning')
    timerStore.setReminder(timerStore.settings.reminderEnabled, 0) // Reset to 0
  } else {
    timerStore.setReminder(timerStore.settings.reminderEnabled, seconds)
  }
}

const overtimeMessageEnabled = computed({
  get: () => timerStore.settings.overtimeMessageEnabled,
  set: (value) => {
    timerStore.setOvertimeMessage(value, timerStore.settings.overtimeMessage)
  },
})

const overtimeMessageInput = computed({
  get: () => timerStore.settings.overtimeMessage,
  set: (value) => {
    timerStore.setOvertimeMessage(timerStore.settings.overtimeMessageEnabled, value)
  },
})

const handleOvertimeMessageBlur = () => {
  if (!overtimeMessageInput.value || overtimeMessageInput.value.trim() === '') {
    showSnackBar($t('timer.overtimeMessageError'), 'warning')
    timerStore.setOvertimeMessage(timerStore.settings.overtimeMessageEnabled, "Time's Up!")
  }
}
const handleOvertimeMessageEnter = (event: Event) => {
  const target = event.target as HTMLInputElement
  target?.blur()
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
.preset-card {
  height: 335px;
}

.external-card {
  height: 250px;
}

.time-separator {
  font-size: 77px;
  font-weight: 500;
}

.time-button {
  min-width: 80px;
  width: 80px;
}

.preset-item {
  transition: all 0.1s ease;
}

.preset-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.5);
}
</style>
