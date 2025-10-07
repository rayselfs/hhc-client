<template>
  <v-dialog v-model="showDialog" max-width="500" persistent>
    <v-card>
      <v-card-title class="text-h5 d-flex align-center">
        <v-icon icon="mdi-download" class="mr-3" color="primary"></v-icon>
        {{ $t('update.downloadTitle') }}
      </v-card-title>

      <v-card-text>
        <div class="mb-4">
          <p class="text-body-1 mb-2">
            {{ $t('update.downloadMessage', { version: updateInfo?.version }) }}
          </p>

          <v-progress-linear
            :model-value="progress"
            color="primary"
            height="8"
            rounded
            class="mb-2"
          ></v-progress-linear>

          <div class="d-flex justify-space-between text-caption text-grey">
            <span>{{ Math.round(progress) }}%</span>
            <span>{{ formatBytes(transferred) }} / {{ formatBytes(total) }}</span>
          </div>

          <div class="d-flex justify-space-between text-caption text-grey mt-1">
            <span>{{ $t('update.downloadSpeed', { speed: formatBytes(speed) }) }}</span>
            <span v-if="eta > 0">{{ $t('update.remainingTime', { time: formatTime(eta) }) }}</span>
          </div>
        </div>

        <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
          {{ error }}
        </v-alert>
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-spacer></v-spacer>
        <v-btn color="grey" variant="text" @click="handleCancel">
          {{ $t('update.cancel') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useElectron } from '@/composables/useElectron'
import type { UpdateInfo, DownloadProgress } from '@/types/electron'

const { isElectron } = useElectron()
const { t: $t } = useI18n()

const showDialog = ref(false)
const updateInfo = ref<UpdateInfo | null>(null)
const progress = ref(0)
const transferred = ref(0)
const total = ref(0)
const speed = ref(0)
const eta = ref(0)
const downloadComplete = ref(false)
const error = ref('')

// 格式化字節數
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化時間
const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}秒`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return `${minutes}分${remainingSeconds}秒`
}

// 處理取消
const handleCancel = () => {
  showDialog.value = false
  // 重置狀態
  progress.value = 0
  transferred.value = 0
  total.value = 0
  speed.value = 0
  eta.value = 0
  downloadComplete.value = false
  error.value = ''
}

// 監聽下載進度事件
onMounted(() => {
  if (!isElectron()) return

  // 監聽更新可用事件，直接顯示下載對話框
  window.electronAPI.onUpdateAvailable((info: UpdateInfo) => {
    updateInfo.value = info
    showDialog.value = true
    downloadComplete.value = false
    error.value = ''
    // 重置進度
    progress.value = 0
    transferred.value = 0
    total.value = 0
    speed.value = 0
    eta.value = 0
  })

  // 監聽下載進度
  window.electronAPI.onDownloadProgress((progressObj: DownloadProgress) => {
    progress.value = progressObj.percent
    transferred.value = progressObj.transferred
    total.value = progressObj.total
    speed.value = progressObj.bytesPerSecond
    eta.value = progressObj.eta
  })

  // 監聽下載完成，顯示安裝確認對話框
  window.electronAPI.onUpdateDownloaded(() => {
    downloadComplete.value = true
    progress.value = 100
    // 關閉下載對話框，觸發安裝確認對話框
    showDialog.value = false
    // 觸發安裝確認對話框
    window.dispatchEvent(
      new CustomEvent('show-install-dialog', {
        detail: { updateInfo: updateInfo.value },
      }),
    )
  })

  // 監聽更新錯誤
  window.electronAPI.onUpdateError((errorMessage) => {
    error.value = errorMessage
  })
})

onBeforeUnmount(() => {
  if (!isElectron()) return

  // 清理監聽器
  window.electronAPI.removeAllListeners('update-available')
  window.electronAPI.removeAllListeners('download-progress')
  window.electronAPI.removeAllListeners('update-downloaded')
  window.electronAPI.removeAllListeners('update-error')
})
</script>

<style scoped>
.v-card-title {
  background-color: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
}
</style>
