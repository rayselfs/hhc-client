<template>
  <v-dialog v-model="showDialog" max-width="500" persistent>
    <v-card>
      <v-card-title class="text-h5 d-flex align-center">
        <v-icon icon="mdi-update" class="mr-3" color="primary"></v-icon>
        {{ $t('update.title') }}
      </v-card-title>

      <v-card-text>
        <div class="mb-4">
          <p class="text-body-1 mb-2">
            {{ $t('update.message', { version: updateInfo?.version }) }}
          </p>
          <p class="text-body-2 text-grey">{{ $t('update.description') }}</p>
        </div>

        <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
          {{ error }}
        </v-alert>
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-spacer></v-spacer>
        <v-btn color="grey" variant="text" @click="handleDecline" :disabled="isDownloading">
          {{ $t('update.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          @click="handleConfirm"
          :loading="isDownloading"
          :disabled="!!error"
        >
          {{ isDownloading ? $t('update.downloading') : $t('update.confirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useElectron } from '@/composables/useElectron'
import type { UpdateInfo } from '@/types/electron'

const { isElectron } = useElectron()
const { t: $t } = useI18n()

const showDialog = ref(false)
const updateInfo = ref<UpdateInfo | null>(null)
const isDownloading = ref(false)
const error = ref('')

// 處理確認更新
const handleConfirm = async () => {
  if (!isElectron()) return

  try {
    isDownloading.value = true
    error.value = ''

    const result = await window.electronAPI.startDownload()
    if (!result.success) {
      error.value = result.error || $t('update.downloadError')
    }
  } catch (err) {
    error.value = $t('update.error')
    console.error('下載更新失敗:', err)
  }
}

// 處理取消更新
const handleDecline = async () => {
  if (!isElectron()) return

  try {
    await window.electronAPI.declineUpdate()
    showDialog.value = false
  } catch (err) {
    console.error('記錄拒絕更新失敗:', err)
  }
}

// 監聽更新事件
onMounted(() => {
  if (!isElectron()) return

  // 監聽更新可用
  window.electronAPI.onUpdateAvailable((info: UpdateInfo) => {
    updateInfo.value = info
    showDialog.value = true
    isDownloading.value = false
    error.value = ''
  })

  // 監聽下載進度
  window.electronAPI.onDownloadProgress((progress) => {
    // 下載開始後，關閉確認對話框，顯示下載進度對話框
    showDialog.value = false
    // 觸發下載進度對話框顯示
    window.dispatchEvent(
      new CustomEvent('show-download-dialog', {
        detail: { progress, updateInfo: updateInfo.value },
      }),
    )
  })

  // 監聽下載完成 - 直接安裝，不需要再次確認
  window.electronAPI.onUpdateDownloaded(() => {
    // 下載完成後直接安裝
    window.electronAPI.installUpdate()
  })

  // 監聽更新錯誤
  window.electronAPI.onUpdateError((errorMessage) => {
    error.value = errorMessage
    isDownloading.value = false
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
