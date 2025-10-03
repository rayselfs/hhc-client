<template>
  <v-container>
    <v-row>
      <!-- 左側：控制計時區 -->
      <v-col cols="6">
        <v-card class="control-card">
          <v-card-text>
            <!-- 模式選擇 -->
            <v-row class="mb-4">
              <v-col cols="12" class="d-flex justify-center">
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

            <!-- 計時器設定 -->
            <v-row
              v-if="
                timerStore.settings.mode === TimerMode.TIMER ||
                timerStore.settings.mode === TimerMode.BOTH
              "
              class="d-flex justify-center"
            >
              <v-col
                v-if="!timerStore.settings.isRunning && (timerStore.settings.pausedTime ?? 0) === 0"
                cols="8"
                class="d-flex justify-center ga-5 pe-2"
              >
                <v-text-field
                  v-model.number="minutes"
                  :label="$t('minutes')"
                  type="number"
                  min="0"
                  max="59"
                  variant="outlined"
                  density="compact"
                  class="time-input"
                  @keyup.enter="handleTimeInput"
                  @blur="handleTimeInput"
                  @input="validateMinutesInput"
                  @keydown="preventNonNumeric"
                ></v-text-field>
                <v-text-field
                  v-model.number="seconds"
                  :label="$t('seconds')"
                  type="number"
                  min="0"
                  max="59"
                  variant="outlined"
                  density="compact"
                  class="time-input"
                  @keyup.enter="handleTimeInput"
                  @blur="handleTimeInput"
                  @input="validateSecondsInput"
                  @keydown="preventNonNumeric"
                ></v-text-field>
              </v-col>

              <!-- 倒數計時器（開始後顯示） -->
              <v-col v-else cols="12">
                <CountdownTimer
                  :progress="timerStore.progress"
                  :timer-formatted-time="timerStore.formattedTime"
                  :size="timerSize"
                />
              </v-col>
            </v-row>

            <!-- 時鐘模式顯示 -->
            <v-row v-if="timerStore.settings.mode === TimerMode.CLOCK">
              <v-col cols="12" class="d-flex justify-center">
                <ClockDisplay :timezone="timerStore.settings.timezone" :size="clockSize" />
              </v-col>
            </v-row>

            <!-- 按鈕區域（保存預設或快捷按鈕） -->
            <v-row
              v-if="
                timerStore.settings.mode === TimerMode.TIMER ||
                timerStore.settings.mode === TimerMode.BOTH
              "
              class="mb-4"
            >
              <v-col cols="12">
                <!-- 保存按鈕（只在未開始時顯示） -->
                <div
                  v-if="
                    !timerStore.settings.isRunning && (timerStore.settings.pausedTime ?? 0) === 0
                  "
                  class="save-button-container"
                >
                  <v-btn
                    class="save-button"
                    color="primary"
                    variant="outlined"
                    @click="saveTimerPreset"
                  >
                    <v-icon icon="mdi-bookmark-plus" class="mr-2"></v-icon>
                    {{ $t('savePreset') }}
                  </v-btn>
                </div>

                <!-- 快捷按鈕（開始計時後顯示） -->
                <div
                  v-else-if="
                    timerStore.settings.isRunning || (timerStore.settings.pausedTime ?? 0) > 0
                  "
                  class="quick-buttons"
                >
                  <v-btn
                    class="quick-button"
                    color="primary"
                    variant="outlined"
                    size="small"
                    @click="addTime(10)"
                  >
                    +0:10
                  </v-btn>
                  <v-btn
                    class="quick-button"
                    color="primary"
                    variant="outlined"
                    size="small"
                    @click="addTime(30)"
                  >
                    +0:30
                  </v-btn>
                  <v-btn
                    class="quick-button"
                    color="primary"
                    variant="outlined"
                    size="small"
                    @click="addTime(60)"
                  >
                    +1:00
                  </v-btn>
                </div>
              </v-col>
            </v-row>

            <!-- 主要控制按鈕（移到卡片底部） -->
            <v-row
              v-if="
                timerStore.settings.mode === TimerMode.TIMER ||
                timerStore.settings.mode === TimerMode.BOTH
              "
              class="mt-auto"
            >
              <v-col cols="12">
                <!-- 開始按鈕（未開始時） -->
                <div
                  v-if="
                    !timerStore.settings.isRunning && (timerStore.settings.pausedTime ?? 0) === 0
                  "
                  class="start-button-container"
                >
                  <v-btn class="start-button" color="primary" size="x-large" @click="startTimer">
                    <v-icon icon="mdi-play" size="large"></v-icon>
                  </v-btn>
                </div>

                <!-- 暫停/繼續和重置按鈕（開始後） -->
                <!-- :class="{ 'paused-button': !timerStore.settings.isRunning }" -->
                <div v-else class="control-buttons-container">
                  <div class="control-buttons">
                    <v-btn
                      class="control-button left-button"
                      :color="timerStore.settings.isRunning ? 'primary' : 'warning'"
                      size="x-large"
                      @click="timerStore.settings.isRunning ? pauseTimer() : resumeTimer()"
                    >
                      <v-icon
                        :icon="timerStore.settings.isRunning ? 'mdi-pause' : 'mdi-play'"
                      ></v-icon>
                    </v-btn>
                    <v-btn
                      class="control-button right-button"
                      :color="timerStore.settings.isRunning ? 'primary' : 'warning'"
                      size="x-large"
                      @click="resetTimer"
                    >
                      <v-icon icon="mdi-refresh"></v-icon>
                    </v-btn>
                  </div>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- 右側：Timer History -->
      <v-col cols="6">
        <v-card class="history-card">
          <v-card-text>
            <v-label class="text-subtitle-1 mb-2">{{ $t('timerPresets') }}</v-label>
            <div v-if="timerStore.presets.length === 0" class="text-center text-grey">
              {{ $t('noPresets') }}
            </div>
            <v-list v-else density="compact">
              <v-list-item v-for="item in timerStore.presets" :key="item.id" class="px-0">
                <template #prepend>
                  <v-icon icon="mdi-history"></v-icon>
                </template>

                <v-list-item-title>
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
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTimerStore } from '@/stores/timer'
import { useProjectionStore } from '@/stores/projection'
import { useElectron } from '@/composables/useElectron'
import { MessageType, ViewType, TimerMode } from '@/types/common'
import CountdownTimer from '@/components/Timer/CountdownTimer.vue'
import ClockDisplay from '@/components/Timer/ClockDisplay.vue'

const timerStore = useTimerStore()
const projectionStore = useProjectionStore()
const { t: $t } = useI18n()

// Electron composable
const { isElectron, sendToProjection: electronSendToProjection } = useElectron()

// 時間輸入
const minutes = ref(5)
const seconds = ref(0)
// 響應式視窗尺寸
const windowSize = ref({
  width: window.innerWidth,
  height: window.innerHeight,
})

// 監聽視窗大小變化
const handleResize = () => {
  windowSize.value = {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

// 計時器
let timerInterval: number | undefined

// 狀態追蹤 - 用於優化投影更新
let lastProjectionState: {
  mode: string
  timerDuration: number
  timezone: string
  isRunning: boolean
  remainingTime: number
  formattedTime: string
  progress: number
} | null = null

// 計算屬性
const currentDuration = computed(() => {
  return minutes.value * 60 + seconds.value
})

// 方法
const updateDuration = () => {
  const duration = currentDuration.value
  timerStore.setTimerDuration(duration)
}

// 處理時間輸入驗證和限制
const validateAndNormalizeTime = () => {
  // 確保輸入的是數字
  if (isNaN(minutes.value) || minutes.value < 0) {
    minutes.value = 0
  }
  if (isNaN(seconds.value) || seconds.value < 0) {
    seconds.value = 0
  }

  // 規則1: 秒數大於60時進位到分鐘
  if (seconds.value >= 60) {
    const extraMinutes = Math.floor(seconds.value / 60)
    minutes.value += extraMinutes
    seconds.value = seconds.value % 60
  }

  // 規則2: 限制最大時間為59分59秒
  if (minutes.value >= 60) {
    minutes.value = 59
    seconds.value = 59
  }

  // 規則3: 時間為0:0時限制為0分30秒
  if (minutes.value === 0 && seconds.value === 0) {
    minutes.value = 0
    seconds.value = 30
  }

  // 確保分鐘和秒數都是整數
  minutes.value = Math.floor(minutes.value)
  seconds.value = Math.floor(seconds.value)
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
  if (isNaN(minutes.value) || minutes.value < 0) {
    minutes.value = 0
  }

  // 限制最大分鐘數為59
  if (minutes.value >= 60) {
    minutes.value = 59
    // 如果分鐘達到上限，將秒數設為59
    if (seconds.value < 59) {
      seconds.value = 59
    }
  }

  minutes.value = Math.floor(minutes.value)
  updateDuration()
}

// 實時驗證秒數輸入
const validateSecondsInput = () => {
  if (isNaN(seconds.value) || seconds.value < 0) {
    seconds.value = 0
  }

  // 秒數大於60時自動進位
  if (seconds.value >= 60) {
    const extraMinutes = Math.floor(seconds.value / 60)
    minutes.value += extraMinutes
    seconds.value = seconds.value % 60

    // 檢查分鐘是否超過限制
    if (minutes.value >= 60) {
      minutes.value = 59
      seconds.value = 59
    }
  }

  // 如果總時間為0:0，設為0:30
  if (minutes.value === 0 && seconds.value === 0) {
    seconds.value = 30
  }

  seconds.value = Math.floor(seconds.value)
  updateDuration()
}

// 處理時間輸入（按 Enter 鍵）
const handleTimeInput = () => {
  validateAndNormalizeTime()
  updateDuration()
  // 立即重置投影上的計時器
  timerStore.resetTimer()
  sendToProjection(true) // 強制更新，因為時間設定改變了
}

// 添加時間（快捷按鈕）
const addTime = (secondsToAdd: number) => {
  timerStore.addTime(secondsToAdd)
  sendToProjection(true) // 強制更新，因為時間被修改了
}

const handleModeChange = (mode: TimerMode) => {
  timerStore.setMode(mode)
  sendToProjection(true) // 強制更新，因為模式改變了
}

const startTimer = () => {
  timerStore.startTimer()

  // 自動顯示投影並切換到計時器視圖
  if (isElectron()) {
    // 更新投影 store 狀態
    projectionStore.setCurrentView('timer')
    projectionStore.setShowingDefault(false)

    // 切換到計時器視圖
    electronSendToProjection({
      type: MessageType.CHANGE_VIEW,
      data: { view: ViewType.TIMER },
    })

    // 確保顯示內容而不是預設畫面
    electronSendToProjection({
      type: MessageType.TOGGLE_PROJECTION_CONTENT,
      data: { showDefault: false },
    })
  }

  sendToProjection(true) // 強制更新，因為計時器開始了
}

const pauseTimer = () => {
  timerStore.pauseTimer()
  sendToProjection(true) // 強制更新，因為計時器暫停了
}

const resetTimer = () => {
  timerStore.resetTimer()
  sendToProjection(true) // 強制更新，因為計時器重置了
}

const resumeTimer = () => {
  timerStore.resumeTimer()
  sendToProjection(true) // 強制更新，因為計時器恢復了
}

const applyPreset = (item: { id: string; duration: number }) => {
  timerStore.applyPreset(item)
  // 更新輸入欄位
  const duration = item.duration
  minutes.value = Math.floor((duration % 3600) / 60)
  seconds.value = duration % 60
  sendToProjection(true) // 強制更新，因為應用了預設
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

// 智能投影更新 - 只在狀態真正改變時發送
const sendToProjection = (forceUpdate = false) => {
  if (!isElectron()) return

  const currentState = {
    mode: timerStore.settings.mode,
    timerDuration: timerStore.settings.timerDuration,
    timezone: timerStore.settings.timezone,
    isRunning: timerStore.settings.isRunning,
    remainingTime: timerStore.settings.remainingTime,
    formattedTime: timerStore.formattedTime,
    progress: timerStore.progress,
  }

  // 檢查狀態是否真的改變了
  const hasStateChanged =
    !lastProjectionState ||
    lastProjectionState.mode !== currentState.mode ||
    lastProjectionState.timerDuration !== currentState.timerDuration ||
    lastProjectionState.timezone !== currentState.timezone ||
    lastProjectionState.isRunning !== currentState.isRunning ||
    lastProjectionState.remainingTime !== currentState.remainingTime ||
    lastProjectionState.formattedTime !== currentState.formattedTime ||
    Math.abs(lastProjectionState.progress - currentState.progress) > 0.1 // 進度變化超過 0.1%

  // 只在狀態改變或強制更新時發送
  if (hasStateChanged || forceUpdate) {
    electronSendToProjection({
      type: MessageType.UPDATE_TIMER,
      data: currentState,
    })

    // 更新最後狀態
    lastProjectionState = { ...currentState }
  }
}

const timerSize = computed(() => {
  const screenWidth = windowSize.value.width
  return 300 * (screenWidth / 1920)
})

const clockSize = computed(() => {
  const screenWidth = windowSize.value.width
  let baseSize = 180
  if (screenWidth < 1920) {
    baseSize = 130
  }

  return baseSize * (screenWidth / 1920)
})

// 生命週期
onMounted(() => {
  // 初始化時間輸入
  const duration = timerStore.settings.timerDuration
  minutes.value = Math.floor(duration / 60)
  seconds.value = duration % 60

  // 初始化時發送一次投影更新
  sendToProjection(true)

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
      sendToProjection() // 使用智能更新，不強制
    }
  }, 1000)
})

onBeforeUnmount(() => {
  if (timerInterval) {
    clearInterval(timerInterval)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.control-card,
.history-card {
  height: 100%;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
}

.control-card :deep(.v-card-text) {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px;
}

/* 開始按鈕容器 */
.start-button-container {
  display: flex;
  justify-content: center;
  margin: 20px 0 0 0;
  padding: 0 5px;
}

.start-button {
  width: calc(100% - 10px);
  height: 50px;
  border-radius: 25px;
}

/* 控制按鈕容器 */
.control-buttons-container {
  margin: 20px 0 0 0;
  padding: 0 5px;
}

.control-buttons {
  display: flex;
  justify-content: center;
  gap: 20px;
  width: calc(100% - 10px);
}

.control-button {
  width: calc(50% - 10px);
  height: 50px;
  border-radius: 25px;
  flex: 1;
}

/* 快捷按鈕 */
.quick-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin: 15px 0;
  min-height: 40px; /* 確保與保存按鈕相同高度 */
  align-items: center;
}

.quick-button {
  min-width: 60px;
  height: 36px; /* 與保存按鈕相同高度 */
}

.time-input {
  width: calc(50% - 10px);
  flex: 1;
}

/* 保存按鈕容器 */
.save-button-container {
  display: flex;
  justify-content: center;
  margin: 15px 0; /* 與快捷按鈕相同的間距 */
  padding: 0 5px;
  min-height: 40px; /* 確保與快捷按鈕相同高度 */
  align-items: center;
}

.save-button {
  min-width: 120px;
  height: 36px; /* 與快捷按鈕相同高度 */
}
</style>
