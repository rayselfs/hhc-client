import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useElectron } from '@/composables/useElectron'

export const useSettingsStore = defineStore('settings', () => {
  const { isElectron, getEnableFfmpeg } = useElectron()

  const isFfmpegEnabled = ref(false)

  const updateFfmpegStatus = async () => {
    if (isElectron()) {
      isFfmpegEnabled.value = await getEnableFfmpeg()
    }
  }

  updateFfmpegStatus()

  return {
    isFfmpegEnabled,
    updateFfmpegStatus,
  }
})
