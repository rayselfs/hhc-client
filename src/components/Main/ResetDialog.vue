<template>
  <v-dialog v-model="dialog" max-width="500" persistent>
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center">
        <v-icon :color="iconColor" size="28" class="mr-2">{{ icon }}</v-icon>
        <span class="text-h5">{{ $t('settings.resetConfirmTitle') }}</span>
      </v-card-title>

      <v-card-text class="pt-4">
        <div class="text-body-1">{{ $t('settings.resetConfirmMessage') }}</div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn color="grey" variant="text" rounded="lg" @click="handleCancel">
          {{ $t('common.cancel') }}
        </v-btn>
        <v-btn :color="confirmButtonColor" variant="text" rounded="lg" @click="handleConfirm">
          {{ $t('common.confirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useElectron } from '@/composables/useElectron'
import { useFactoryReset } from '@/composables/useReset'

const { isElectron, onMainMessage, removeAllListeners } = useElectron()
const { performFactoryReset } = useFactoryReset()

// Dialog 狀態
const dialog = ref(false)

// Dialog 配置
const icon = ref('mdi-alert')
const iconColor = ref('error')
const confirmButtonColor = ref('error')

// 處理確認
const handleConfirm = async () => {
  dialog.value = false
  await performFactoryReset()
}

// 處理取消
const handleCancel = () => {
  dialog.value = false
}

// 監聽來自 Electron menu 的消息
const handleMainMessage = (data: unknown) => {
  if (data === 'reset-factory-settings') {
    dialog.value = true
  }
}

// 生命週期
onMounted(() => {
  if (isElectron()) {
    onMainMessage(handleMainMessage)
  }
})

onBeforeUnmount(() => {
  if (isElectron()) {
    removeAllListeners('main-message')
  }
})
</script>

<style scoped></style>
