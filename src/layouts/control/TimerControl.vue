<template>
  <v-container>
    <v-row>
      <!-- Left Side - Control Timer -->
      <v-col cols="6">
        <v-card class="control-card rounded-lg">
          <v-card-text>
            <!-- Timer Mode Selection -->
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
                    {{ $t('timerMode') }}
                  </v-btn>
                  <v-btn value="both">
                    <v-icon icon="mdi-view-split-horizontal" class="mr-2"></v-icon>
                    {{ $t('bothMode') }}
                  </v-btn>
                  <v-btn value="clock">
                    <v-icon icon="mdi-clock" class="mr-2"></v-icon>
                    {{ $t('clockMode') }}
                  </v-btn>
                </v-btn-toggle>
              </v-col>
            </v-row>

            <!-- Timer Settings -->
            <v-row>
              <v-col cols="12">
                <CountdownTimer
                  :progress="timerStore.progress"
                  :timer-formatted-time="timerStore.formattedTime"
                  :size="250"
                  :display-text="timerStore.settings.isRunning"
                >
                  <template #content>
                    <div
                      v-if="
                        !timerStore.settings.isRunning &&
                        (timerStore.settings.pausedTime ?? 0) === 0
                      "
                      class="d-flex justify-center align-center"
                    >
                      <v-text-field
                        v-model="minutes"
                        variant="plain"
                        density="compact"
                        hide-details
                        class="time-input-field"
                        :placeholder="minutesPlaceholder"
                        @focus="handleMinutesFocus"
                        @blur="handleMinutesBlur"
                        @keyup.enter="handleTimeInput"
                        @input="validateMinutesInput"
                        @keydown="preventNonNumeric"
                      ></v-text-field>
                      <span class="time-separator">:</span>
                      <v-text-field
                        v-model="seconds"
                        variant="plain"
                        density="compact"
                        hide-details
                        class="time-input-field"
                        :placeholder="secondsPlaceholder"
                        @focus="handleSecondsFocus"
                        @blur="handleSecondsBlur"
                        @keyup.enter="handleTimeInput"
                        @input="validateSecondsInput"
                        @keydown="preventNonNumeric"
                      ></v-text-field>
                    </div>
                    <span v-else>{{ timerStore.formattedTime }}</span>
                  </template>
                </CountdownTimer>
              </v-col>
            </v-row>

            <!-- Quick Add Time Buttons -->
            <v-row class="mb-4">
              <v-col cols="12" align="center">
                <v-btn class="ma-2" color="primary" variant="outlined" @click="addTime(10)">
                  +0:10
                </v-btn>
                <v-btn class="ma-2" color="primary" variant="outlined" @click="addTime(30)">
                  +0:30
                </v-btn>
                <v-btn class="ma-2" color="primary" variant="outlined" @click="addTime(60)">
                  +1:00
                </v-btn>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="6" class="d-flex justify-end">
                <v-btn
                  v-if="
                    !timerStore.settings.isRunning && (timerStore.settings.pausedTime ?? 0) === 0
                  "
                  icon="mdi-play"
                  color="primary"
                  variant="flat"
                  :disabled="timerStore.settings.mode === 'clock'"
                  @click="startTimer"
                ></v-btn>
                <v-btn
                  v-else
                  :icon="timerStore.settings.isRunning ? 'mdi-pause' : 'mdi-play'"
                  :color="timerStore.settings.isRunning ? 'warning' : 'primary'"
                  variant="flat"
                  :disabled="timerStore.settings.mode === 'clock'"
                  @click="timerStore.settings.isRunning ? pauseTimer() : resumeTimer()"
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

      <!-- Right Side - Preset and Clock Cards -->
      <v-col cols="6">
        <!-- Timer Presets -->
        <v-card class="preset-card mb-5 rounded-lg">
          <v-card-text>
            <div class="d-flex justify-space-between mb-2">
              <v-label class="text-h6 align-start">{{ $t('timerPresets') }}</v-label>
              <v-btn
                icon="mdi-plus"
                size="small"
                variant="tonal"
                :disabled="
                  timerStore.settings.isRunning || (timerStore.settings.pausedTime ?? 0) > 0
                "
                :class="{
                  'cursor-not-allowed':
                    timerStore.settings.isRunning || (timerStore.settings.pausedTime ?? 0) > 0,
                }"
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

        <!-- External Display -->
        <v-card class="external-card rounded-lg">
          <v-card-text>
            <!-- External Display Toggle -->
            <v-row>
              <v-col cols="12" align="center">
                <v-btn
                  :color="externalDisplayMode === 'stopwatch' ? 'primary' : 'grey'"
                  :variant="externalDisplayMode === 'stopwatch' ? 'flat' : 'outlined'"
                  @click="toggleStopwatch"
                >
                  <v-icon icon="mdi-timer-outline" class="mr-2"></v-icon>
                  {{ $t('stopwatch') }}
                </v-btn>
              </v-col>
            </v-row>

            <!-- Clock Display -->
            <v-row v-if="externalDisplayMode === 'clock'">
              <v-col cols="12" align="center">
                <ClockDisplay :timezone="timerStore.settings.timezone" :size="clockSize" />
              </v-col>
            </v-row>

            <!-- Stopwatch Display -->
            <v-row v-else>
              <v-col cols="12" align="center" class="pb-0">
                <div class="stopwatch-time">{{ stopwatchTime }}</div>
              </v-col>
              <v-col cols="6" class="d-flex justify-end">
                <v-btn
                  v-if="!isStopwatchRunning"
                  icon="mdi-play"
                  color="primary"
                  variant="flat"
                  @click="startStopwatch"
                ></v-btn>
                <v-btn
                  v-else
                  icon="mdi-pause"
                  color="warning"
                  variant="flat"
                  @click="pauseStopwatch"
                ></v-btn>
              </v-col>
              <v-col cols="6" class="d-flex justify-start">
                <v-btn
                  icon="mdi-refresh"
                  color="grey"
                  variant="outlined"
                  :disabled="!isStopwatchRunning && stopwatchTime === '00:00'"
                  @click="resetStopwatch"
                ></v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTimerStore } from '@/stores/timer'
// import { useProjectionStore } from '@/stores/projection' // 不再需要，已移至 useProjectionMessaging
import { useElectron } from '@/composables/useElectron'
import { useProjectionMessaging } from '@/composables/useProjectionMessaging'
import { TimerMode } from '@/types/common'
import CountdownTimer from '@/components/Timer/CountdownTimer.vue'
import ClockDisplay from '@/components/Timer/ClockDisplay.vue'
import { useMemoryManager } from '@/utils/memoryManager'
import { throttle } from '@/utils/performanceUtils'

const timerStore = useTimerStore()
const { t: $t } = useI18n()

// Electron composable
const { isElectron } = useElectron()

// 投影消息管理
const { sendTimerUpdate, sendTimerStartProjection, forceRefreshAll, cleanupResources } =
  useProjectionMessaging()

// 記憶體管理
const { track, untrack, cleanup } = useMemoryManager('TimerControl')

// 時間輸入
const minutes = ref('5')
const seconds = ref('0')

// 輸入框焦點狀態和佔位符
const minutesFocused = ref(false)
const secondsFocused = ref(false)
const minutesPlaceholder = computed(() => (minutesFocused.value ? '00' : ''))
const secondsPlaceholder = computed(() => (secondsFocused.value ? '00' : ''))

// External Display 模式 - 使用 store 中的狀態
const externalDisplayMode = computed(() => timerStore.stopwatchSettings.displayMode)

// 響應式視窗尺寸
const windowSize = ref({
  width: window.innerWidth,
  height: window.innerHeight,
})

// 監聽視窗大小變化（使用節流優化）
const handleResize = throttle(() => {
  windowSize.value = {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}, 100)

// 計時器
let timerInterval: number | undefined

// 計算屬性
const currentDuration = computed(() => {
  return parseInt(minutes.value) * 60 + parseInt(seconds.value)
})

// 方法
const updateDuration = () => {
  const duration = currentDuration.value
  timerStore.setTimerDuration(duration)
}

// 處理時間輸入驗證和限制
const validateAndNormalizeTime = () => {
  // 轉換為數字並確保是有效值
  const minutesNum = parseInt(minutes.value) || 0
  const secondsNum = parseInt(seconds.value) || 0

  if (minutesNum < 0) {
    minutes.value = '00'
  } else {
    minutes.value = minutesNum.toString().padStart(2, '0')
  }

  if (secondsNum < 0) {
    seconds.value = '00'
  } else {
    seconds.value = secondsNum.toString().padStart(2, '0')
  }

  // 規則1: 秒數大於60時進位到分鐘
  if (parseInt(seconds.value) >= 60) {
    const extraMinutes = Math.floor(parseInt(seconds.value) / 60)
    minutes.value = (parseInt(minutes.value) + extraMinutes).toString().padStart(2, '0')
    seconds.value = (parseInt(seconds.value) % 60).toString().padStart(2, '0')
  }

  // 規則2: 限制最大時間為59分59秒
  if (parseInt(minutes.value) >= 60) {
    minutes.value = '59'
    seconds.value = '59'
  }

  // 規則3: 時間為0:0時限制為0分30秒（但允許用戶輸入00）
  if (parseInt(minutes.value) === 0 && parseInt(seconds.value) === 0) {
    // 只有在用戶沒有主動輸入00時才自動設為30
    if (seconds.value !== '00') {
      minutes.value = '00'
      seconds.value = '30'
    }
  }

  // 確保分鐘和秒數都是整數並保持兩位數格式
  minutes.value = Math.floor(parseInt(minutes.value)).toString().padStart(2, '0')
  seconds.value = Math.floor(parseInt(seconds.value)).toString().padStart(2, '0')
}

// 防止非數字輸入
const preventNonNumeric = (event: KeyboardEvent) => {
  // 允許的按鍵：數字、退格、刪除、Tab、Enter、箭頭鍵
  const allowedKeys = [
    'Backspace',
    'Delete',
    'Tab',
    'Enter',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
  ]

  if (allowedKeys.includes(event.key)) {
    return
  }

  // 只允許數字輸入
  if (!/^\d$/.test(event.key)) {
    event.preventDefault()
  }
}

// 實時驗證分鐘輸入
const validateMinutesInput = () => {
  // 轉換為數字並驗證
  const numValue = parseInt(minutes.value) || 0

  if (numValue < 0) {
    minutes.value = '00'
  } else if (numValue >= 60) {
    minutes.value = '59'
    // 如果分鐘達到上限，將秒數設為59
    if (parseInt(seconds.value) < 59) {
      seconds.value = '59'
    }
  } else {
    // 顯示為兩位數格式
    minutes.value = numValue.toString().padStart(2, '0')
  }

  // 如果總時間為0:0，設為0:30（但允許用戶輸入00）
  if (parseInt(minutes.value) === 0 && parseInt(seconds.value) === 0) {
    seconds.value = '30'
  }

  updateDuration()
}

// 實時驗證秒數輸入
const validateSecondsInput = () => {
  // 允許輸入 "00" 但保持其他驗證
  const inputValue = seconds.value.trim()

  // 如果輸入為空或只有空格，設為 "0"
  if (inputValue === '') {
    seconds.value = '0'
    updateDuration()
    return
  }

  // 轉換為數字並驗證
  const numValue = parseInt(inputValue) || 0

  if (numValue < 0) {
    seconds.value = '00'
  } else if (numValue >= 60) {
    // 秒數大於60時自動進位
    const extraMinutes = Math.floor(numValue / 60)
    const newMinutes = parseInt(minutes.value) + extraMinutes
    const newSeconds = numValue % 60

    // 檢查分鐘是否超過限制
    if (newMinutes >= 60) {
      minutes.value = '59'
      seconds.value = '59'
    } else {
      minutes.value = newMinutes.toString().padStart(2, '0')
      seconds.value = newSeconds.toString().padStart(2, '0')
    }
  } else {
    // 顯示為兩位數格式，允許 "00"
    if (inputValue === '00' || inputValue === '0') {
      seconds.value = '00'
    } else {
      seconds.value = numValue.toString().padStart(2, '0')
    }
  }

  // 如果總時間為0:0，設為0:30（但允許用戶輸入00）
  if (parseInt(minutes.value) === 0 && parseInt(seconds.value) === 0) {
    seconds.value = '30'
  }

  updateDuration()
}

// 處理分鐘輸入框焦點
const handleMinutesFocus = () => {
  minutesFocused.value = true
  // 清除內容讓用戶重新輸入
  minutes.value = ''
}

const handleMinutesBlur = () => {
  minutesFocused.value = false
  // 如果為空，設為 00
  if (minutes.value === '') {
    minutes.value = '00'
  }

  if (parseInt(minutes.value) === 0 && parseInt(seconds.value) === 0) {
    seconds.value = '30'
  }
  handleTimeInput()
}

// 處理秒數輸入框焦點
const handleSecondsFocus = () => {
  secondsFocused.value = true
  // 清除內容讓用戶重新輸入
  seconds.value = ''
}

const handleSecondsBlur = () => {
  secondsFocused.value = false
  // 如果為空，設為 00
  if (seconds.value === '') {
    seconds.value = '00'
  }

  if (parseInt(minutes.value) === 0 && parseInt(seconds.value) === 0) {
    seconds.value = '30'
  }
  handleTimeInput()
}

// 更新計時器持續時間
const updateTimerDuration = () => {
  validateAndNormalizeTime()
  updateDuration()
  // 立即重置投影上的計時器
  timerStore.resetTimer()
  sendTimerUpdate(true) // 強制更新，因為時間設定改變了
}

// 處理時間輸入（按 Enter 鍵）
const handleTimeInput = () => {
  updateTimerDuration()
}

// 添加時間（快捷按鈕）
const addTime = (secondsToAdd: number) => {
  // 如果計時器正在運行，使用 store 的 addTime 方法
  if (timerStore.settings.isRunning) {
    timerStore.addTime(secondsToAdd)
  } else {
    // 如果計時器未運行，直接調整輸入框的時間
    const currentTotalSeconds = parseInt(minutes.value) * 60 + parseInt(seconds.value)
    const newTotalSeconds = currentTotalSeconds + secondsToAdd

    // 限制最大時間為 59:59
    const maxSeconds = 59 * 60 + 59
    const finalSeconds = Math.min(newTotalSeconds, maxSeconds)

    // 更新輸入框
    const newMinutes = Math.floor(finalSeconds / 60)
    const newSeconds = finalSeconds % 60

    minutes.value = newMinutes.toString().padStart(2, '0')
    seconds.value = newSeconds.toString().padStart(2, '0')

    // 更新計時器持續時間
    updateDuration()
  }

  sendTimerUpdate(true) // 強制更新，因為時間被修改了
}

const handleModeChange = (mode: TimerMode) => {
  timerStore.setMode(mode)
  sendTimerUpdate(true) // 強制更新，因為模式改變了
}

const startTimer = () => {
  timerStore.startTimer()

  // 自動顯示投影並切換到計時器視圖
  if (isElectron()) {
    sendTimerStartProjection()
  }

  sendTimerUpdate(true) // 強制更新，因為計時器開始了
}

const pauseTimer = () => {
  timerStore.pauseTimer()
  sendTimerUpdate(true) // 強制更新，因為計時器暫停了
}

const resetTimer = () => {
  timerStore.resetTimer()
  sendTimerUpdate(true) // 強制更新，因為計時器重置了
}

const resumeTimer = () => {
  timerStore.resumeTimer()
  sendTimerUpdate(true) // 強制更新，因為計時器恢復了
}

const applyPreset = (item: { id: string; duration: number }) => {
  timerStore.applyPreset(item)
  // 更新輸入欄位
  const duration = item.duration
  minutes.value = Math.floor((duration % 3600) / 60)
    .toString()
    .padStart(2, '0')
  seconds.value = (duration % 60).toString().padStart(2, '0')
  sendTimerUpdate(true) // 強制更新，因為應用了預設
}

const deletePreset = (id: string) => {
  timerStore.deletePreset(id)
}

// 保存計時器預設
const saveTimerPreset = () => {
  const duration = currentDuration.value
  timerStore.addToPresets(duration)
}

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

// 智能投影更新已移至 useProjectionMessaging 中處理

const clockSize = computed(() => {
  const screenWidth = windowSize.value.width
  return 90 * (screenWidth / 1920)
})

// 碼錶相關 - 使用 store 中的方法
const toggleStopwatch = () => {
  timerStore.toggleStopwatchMode()
}

const startStopwatch = () => {
  timerStore.startStopwatch()
}

const pauseStopwatch = () => {
  timerStore.pauseStopwatch()
}

const resetStopwatch = () => {
  timerStore.resetStopwatch()
}

// 碼錶時間顯示
const stopwatchTime = computed(() => timerStore.getStopwatchTime())
const isStopwatchRunning = computed(() => timerStore.stopwatchSettings.isRunning)

// 生命週期
onMounted(() => {
  // 初始化時間輸入
  const duration = timerStore.settings.timerDuration
  minutes.value = Math.floor(duration / 60)
    .toString()
    .padStart(2, '0')
  seconds.value = (duration % 60).toString().padStart(2, '0')

  // 初始化時發送一次投影更新
  forceRefreshAll()

  // 追蹤事件監聽器
  track('resize-listener', 'listener', {
    element: window,
    event: 'resize',
    handler: handleResize,
  })
  window.addEventListener('resize', handleResize)

  // 啟動計時器
  timerInterval = window.setInterval(() => {
    const wasRunning = timerStore.settings.isRunning
    const wasRemainingTime = timerStore.settings.remainingTime

    timerStore.tick()

    // 只在以下情況發送投影更新：
    // 1. 計時器正在運行且時間有變化
    // 2. 計時器剛結束（從運行變為停止）
    // 3. 剩餘時間為 0（確保結束狀態被發送）
    const shouldUpdate =
      (wasRunning && timerStore.settings.remainingTime !== wasRemainingTime) ||
      (wasRunning && !timerStore.settings.isRunning) ||
      (timerStore.settings.remainingTime === 0 && wasRemainingTime > 0)

    if (shouldUpdate) {
      sendTimerUpdate() // 使用智能更新，不強制
    }
  }, 1000)

  // 追蹤計時器
  track('timer-interval', 'interval', timerInterval)
})

onBeforeUnmount(() => {
  // 清理計時器
  if (timerInterval) {
    untrack('timer-interval')
    clearInterval(timerInterval)
  }

  // 清理事件監聽器
  untrack('resize-listener')
  window.removeEventListener('resize', handleResize)

  // 清理投影資源
  cleanupResources()
})

onUnmounted(() => {
  cleanup()
})
</script>

<style scoped>
.control-card {
  height: 600px;
}

.preset-card {
  height: 330px;
}

.external-card {
  height: 250px;
}

.stopwatch-time {
  font-size: 60px;
  font-weight: 500;
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
</style>
