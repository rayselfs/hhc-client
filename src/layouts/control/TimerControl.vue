<template>
  <v-container fluid class="pa-0">
    <v-row no-gutters>
      <!-- Timer -->
      <v-col
        cols="12"
        sm="6"
        class="pl-4 pt-4 pb-4 pr-sm-2 pr-4 mb-sm-0 mb-4"
        :style="{ height: `${leftCardHeight}px` }"
      >
        <v-card :style="{ height: `${leftCardHeight}px` }">
          <v-card-text>
            <v-row class="mb-4">
              <v-col cols="12" align="center">
                <v-btn-toggle
                  v-model="timerStore.settings.mode"
                  variant="outlined"
                  mandatory
                  class="mode-toggle"
                  @update:model-value="handleModeChange"
                >
                  <v-btn value="timer">
                    <v-icon icon="mdi-timer" class="mr-2"></v-icon>
                    {{ $t('timer.mode.timer') }}
                  </v-btn>
                  <v-btn value="both">
                    <v-icon icon="mdi-view-split-horizontal" class="mr-2"></v-icon>
                    {{ $t('timer.mode.both') }}
                  </v-btn>
                  <v-btn value="clock" :disabled="timerStore.state !== 'stopped'">
                    <v-icon icon="mdi-clock" class="mr-2"></v-icon>
                    {{ $t('timer.mode.clock') }}
                  </v-btn>
                </v-btn-toggle>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12">
                <CountdownTimer
                  :progress="timerStore.progress"
                  :timer-formatted-time="timerStore.formattedTime"
                  :size="250"
                  :display-text="timerStore.isRunning"
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
              </v-col>
            </v-row>

            <!-- Remove Time Buttons -->
            <v-row>
              <v-col cols="12" align="center" class="pb-0">
                <v-btn
                  class="ma-2 time-button"
                  color="orange"
                  variant="outlined"
                  :disabled="!canRemoveTime(10)"
                  @click="removeTime(10)"
                >
                  -0:10
                </v-btn>
                <v-btn
                  class="ma-2 time-button"
                  color="orange"
                  variant="outlined"
                  :disabled="!canRemoveTime(30)"
                  @click="removeTime(30)"
                >
                  -0:30
                </v-btn>
                <v-btn
                  class="ma-2 time-button"
                  color="orange"
                  variant="outlined"
                  :disabled="!canRemoveTime(60)"
                  @click="removeTime(60)"
                >
                  -1:00
                </v-btn>
              </v-col>
            </v-row>

            <!-- Add Time Buttons -->
            <v-row class="mb-4">
              <v-col cols="12" align="center" class="pt-0">
                <v-btn
                  class="ma-2 time-button"
                  color="primary"
                  variant="outlined"
                  @click="addTime(10)"
                >
                  +0:10
                </v-btn>
                <v-btn
                  class="ma-2 time-button"
                  color="primary"
                  variant="outlined"
                  @click="addTime(30)"
                >
                  +0:30
                </v-btn>
                <v-btn
                  class="ma-2 time-button"
                  color="primary"
                  variant="outlined"
                  @click="addTime(60)"
                >
                  +1:00
                </v-btn>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="6" class="d-flex justify-end">
                <v-btn
                  v-if="timerStore.state === 'stopped'"
                  icon="mdi-play"
                  color="primary"
                  variant="flat"
                  :disabled="timerStore.settings.mode === 'clock'"
                  @click="startTimer"
                ></v-btn>
                <v-btn
                  v-if="timerStore.state === 'running'"
                  icon="mdi-pause"
                  color="warning"
                  variant="flat"
                  :disabled="timerStore.settings.mode === 'clock'"
                  @click="pauseTimer"
                ></v-btn>
                <v-btn
                  v-if="timerStore.state === 'paused'"
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

      <v-col cols="12" sm="6" class="pl-sm-2 pl-4 pt-4 pb-4 pr-4">
        <v-row no-gutters class="fill-height">
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

          <v-col cols="12" :style="{ height: `${rightBottomCardHeight}px` }">
            <v-card :style="{ height: `${rightBottomCardHeight}px` }">
              <v-card-text>
                <v-row>
                  <v-col cols="12" align="center">
                    <v-btn
                      :color="externalDisplayMode === 'stopwatch' ? 'primary' : 'grey'"
                      :variant="externalDisplayMode === 'stopwatch' ? 'flat' : 'outlined'"
                      @click="toggleStopwatch"
                    >
                      <v-icon icon="mdi-timer-outline" class="mr-2"></v-icon>
                      {{ $t('timer.stopwatch') }}
                    </v-btn>
                  </v-col>
                </v-row>

                <v-row v-if="externalDisplayMode === 'clock'">
                  <v-col cols="12" align="center">
                    <ClockDisplay :timezone="timerStore.settings.timezone" :size="clockSize" />
                  </v-col>
                </v-row>

                <Stopwatch v-else />
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
import { useI18n } from 'vue-i18n'
import { useTimerStore } from '@/stores/timer'
import { useStopwatchStore } from '@/stores/stopwatch'
import { useProjectionStore } from '@/stores/projection'
import { useElectron } from '@/composables/useElectron'
import { useProjectionMessaging } from '@/composables/useProjectionMessaging'
import { APP_CONFIG, TIMER_CONFIG } from '@/config/app'
import { TimerMode, ViewType } from '@/types/common'
import CountdownTimer from '@/components/Timer/CountdownTimer.vue'
import ClockDisplay from '@/components/Timer/ClockDisplay.vue'
import Stopwatch from '@/components/Timer/StopWatcher.vue'
import { useMemoryManager } from '@/utils/memoryManager'
import { useSnackBar } from '@/composables/useSnackBar'
import { useCardLayout, useWindowSize } from '@/composables/useLayout'

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

// Read display mode from stopwatch store
const externalDisplayMode = computed(() => stopwatchStore.stopwatchSettings.displayMode)

// 使用統一的視窗尺寸 composable
const { width } = useWindowSize(100)

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

const canRemoveTime = (secondsToRemove: number) => {
  return timerStore.settings.remainingTime > secondsToRemove
}

const removeTime = (secondsToRemove: number) => {
  timerStore.removeTime(secondsToRemove)
}

const handleModeChange = (mode: TimerMode) => {
  timerStore.setMode(mode)
}

const startTimer = async () => {
  timerStore.startTimer()
  await updateProjectionState()
}

const pauseTimer = () => {
  timerStore.pauseTimer()
}

const resetTimer = () => {
  timerStore.resetTimer()
}

const resumeTimer = async () => {
  timerStore.resumeTimer()
  await updateProjectionState()
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

// clockSize logic remains the same
const clockSize = computed(() => {
  const screenWidth = width.value
  return TIMER_CONFIG.UI.CLOCK_BASE_SIZE * (screenWidth / TIMER_CONFIG.UI.SCREEN_BASE_WIDTH)
})

// Calls stopwatch store action
const toggleStopwatch = () => {
  stopwatchStore.toggleStopwatchMode()
}

// Lifecycle
onMounted(() => {
  // Removed time initialization, v-model handles it
  syncAllStates()

  // useWindowSize 已經處理了 resize 監聽器，不需要手動添加
})

onBeforeUnmount(() => {
  // useWindowSize 已經處理了 resize 監聽器的清理，不需要手動清理

  // Cleanup projection resources
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
