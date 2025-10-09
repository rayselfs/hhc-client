<template>
  <v-dialog v-model="showDialog" max-width="500" persistent>
    <v-card>
      <v-card-title class="text-h5 d-flex align-center">
        <v-icon icon="mdi-download" class="mr-3" color="success"></v-icon>
        {{ $t('update.readyToInstall') }}
      </v-card-title>

      <v-card-text>
        <div class="mb-4">
          <p class="text-body-1 mb-2">
            {{ $t('update.installMessage', { version: updateInfo?.version }) }}
          </p>
          <p class="text-body-2 text-grey">{{ $t('update.installDescription') }}</p>
        </div>

        <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
          {{ error }}
        </v-alert>
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-spacer></v-spacer>
        <v-btn color="grey" variant="text" @click="handleDelay" :disabled="isInstalling">
          {{ $t('update.delay') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          @click="handleInstall"
          :loading="isInstalling"
          :disabled="!!error"
        >
          {{ isInstalling ? $t('update.installing') : $t('update.installNow') }}
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
const isInstalling = ref(false)
const error = ref('')

// 處理立即安裝
const handleInstall = async () => {
  if (!isElectron()) return

  try {
    isInstalling.value = true
    error.value = ''

    // 直接安裝更新
    await window.electronAPI.installUpdate()
  } catch (err) {
    error.value = $t('update.installError')
    isInstalling.value = false
    console.error('安裝更新失敗:', err)
  }
}

// 處理延遲安裝（關閉視窗時選擇稍後）
const handleDelay = async () => {
  if (!isElectron()) return

  try {
    showDialog.value = false
    // 通知主進程繼續退出流程
    await window.electronAPI.forceQuit()
  } catch (err) {
    console.error('退出應用失敗:', err)
  }
}

// 監聽更新事件
onMounted(() => {
  if (!isElectron()) return

  // 監聽準備安裝事件（用戶關閉主視窗時觸發）
  window.electronAPI.onUpdateReadyToInstall((info) => {
    updateInfo.value = info
    showDialog.value = true
    isInstalling.value = false
    error.value = ''
  })

  // 監聽更新錯誤
  window.electronAPI.onUpdateError((errorMessage) => {
    error.value = errorMessage
    isInstalling.value = false
  })
})

onBeforeUnmount(() => {
  if (!isElectron()) return

  // 清理監聽器
  window.electronAPI.removeAllListeners('update-ready-to-install')
  window.electronAPI.removeAllListeners('update-error')
})
</script>

<style scoped>
.v-card-title {
  background-color: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
}
</style>
