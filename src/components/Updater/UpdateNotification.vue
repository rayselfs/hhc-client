<template>
  <v-snackbar
    v-model="isVisible"
    :timeout="-1"
    color="info"
    location="bottom right"
    variant="tonal"
    class="update-notification"
  >
    <div class="d-flex align-center">
      <v-icon icon="mdi-download" class="mr-2"></v-icon>
      <span class="mr-2">{{ $t('update.downloading') }}</span>
      <v-progress-circular
        v-if="isDownloading"
        indeterminate
        size="16"
        width="2"
        color="white"
      ></v-progress-circular>
    </div>
  </v-snackbar>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useElectron } from '@/composables/useElectron'
import { useSnackBar } from '@/composables/useSnackBar'

const { t: $t } = useI18n()
const { isElectron } = useElectron()
const { hideSnackBar } = useSnackBar()

const isVisible = ref(false)
const isDownloading = ref(false)

onMounted(() => {
  if (!isElectron()) return

  // 監聽更新可用事件，顯示下載通知
  window.electronAPI.onUpdateAvailable(() => {
    isDownloading.value = true
    isVisible.value = true
  })

  // 監聽下載完成事件，隱藏通知
  window.electronAPI.onUpdateDownloaded(() => {
    isDownloading.value = false
    isVisible.value = false
    hideSnackBar()
  })

  // 監聽更新錯誤事件，隱藏通知
  window.electronAPI.onUpdateError(() => {
    isDownloading.value = false
    isVisible.value = false
    hideSnackBar()
  })
})

onBeforeUnmount(() => {
  if (!isElectron()) return

  window.electronAPI.removeAllListeners('update-available')
  window.electronAPI.removeAllListeners('update-downloaded')
  window.electronAPI.removeAllListeners('update-error')
})
</script>

<style scoped>
.update-notification {
  z-index: 9999;
}
</style>
