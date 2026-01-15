<template>
  <v-dialog v-model="isOpen" max-width="500">
    <v-card>
      <v-card-title class="text-subtitle-1 d-flex align-center">
        {{ $t('settings.title') }}
      </v-card-title>

      <v-card-text>
        <v-row>
          <v-col cols="12">
            <v-label class="text-subtitle-1 mb-2">{{ $t('settings.language') }}</v-label>
            <v-select
              v-model="selectedLanguage"
              :items="languageOptions"
              item-title="text"
              item-value="value"
              variant="outlined"
              density="compact"
              @update:model-value="handleLanguageChange"
            >
              <template v-slot:item="{ props, item }">
                <v-list-item v-bind="props" :title="$t(item.raw.text)"></v-list-item>
              </template>
              <template v-slot:selection="{ item }">
                {{ $t(item.raw.text) }}
              </template>
            </v-select>
          </v-col>
          <v-col cols="12">
            <v-label class="text-subtitle-1 mb-2">{{ $t('settings.timezone') }}</v-label>
            <v-select
              v-model="selectedTimezone"
              :items="timezones"
              variant="outlined"
              density="compact"
              @update:model-value="handleTimezoneChange"
            ></v-select>
          </v-col>
          <v-col cols="12">
            <v-label class="text-subtitle-1 mb-2">{{ $t('settings.theme') }}</v-label>
            <v-switch
              v-model="isDarkMode"
              :label="$t('settings.darkMode')"
              color="primary"
            ></v-switch>
          </v-col>
          <v-col cols="12">
            <v-label class="text-subtitle-1 mb-2">{{ $t('settings.performance') }}</v-label>
            <v-switch
              v-model="hardwareAcceleration"
              :label="$t('settings.hardwareAcceleration')"
              color="primary"
              @update:model-value="handleHardwareAccelerationChange"
            ></v-switch>
          </v-col>
        </v-row>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn @click="isOpen = false"> {{ $t('common.close') }} </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Restart Required Dialog -->
  <v-dialog v-model="showRestartDialog" max-width="400" persistent>
    <v-card>
      <v-card-title class="text-subtitle-1">
        {{ $t('settings.restartRequired') }}
      </v-card-title>
      <v-card-text>
        {{ $t('settings.restartRequiredMessage') }}
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="showRestartDialog = false">
          {{ $t('common.later') }}
        </v-btn>
        <v-btn color="primary" variant="flat" @click="restartApp">
          {{ $t('common.restartNow') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTimerStore } from '@/stores/timer'
import { useElectron } from '@/composables/useElectron'
import { useDarkMode } from '@/composables/useDarkMode'
import { useLocaleDetection } from '@/composables/useLocaleDetection'

import { useProjectionManager } from '@/composables/useProjectionManager'

// i18n
const { t: $t, t } = useI18n()

// Electron composable
const {
  isElectron,
  onMainMessage,
  getHardwareAcceleration,
  setHardwareAcceleration,
  restartApp: electronRestartApp,
} = useElectron()

// 投影消息管理
const { syncAllStates } = useProjectionManager()

// 設定彈窗狀態
const isOpen = ref(false)

// 語系管理
const { selectedLanguage, languageOptions, handleLanguageChange } = useLocaleDetection()

// 時區設定
const timerStore = useTimerStore()
const selectedTimezone = ref(timerStore.settings.timezone)

// Dark mode 設定
const { isDark, toggleDark } = useDarkMode()
const isDarkMode = computed({
  get: () => isDark.value,
  set: (value: boolean) => {
    if (value !== isDark.value) {
      toggleDark()
    }
  },
})

// Hardware acceleration 設定
const hardwareAcceleration = ref(true)
const showRestartDialog = ref(false)

// Timezone options
const timezones = computed(() => [
  { title: t('timezones.taipei'), value: 'Asia/Taipei' },
  { title: t('timezones.hongKong'), value: 'Asia/Hong_Kong' },
  { title: t('timezones.singapore'), value: 'Asia/Singapore' },
  { title: t('timezones.tokyo'), value: 'Asia/Tokyo' },
  { title: t('timezones.seoul'), value: 'Asia/Seoul' },
  { title: t('timezones.newYork'), value: 'America/New_York' },
  { title: t('timezones.london'), value: 'Europe/London' },
  { title: t('timezones.paris'), value: 'Europe/Paris' },
  { title: t('timezones.utc'), value: 'UTC' },
])

// 處理時區變更
const handleTimezoneChange = (timezone: string) => {
  timerStore.setTimezone(timezone)
  syncAllStates()
}

// 處理硬體加速變更
const handleHardwareAccelerationChange = async (enabled: boolean | null) => {
  if (isElectron() && enabled !== null) {
    await setHardwareAcceleration(enabled)
    showRestartDialog.value = true
  }
}

// 重啟應用程式
const restartApp = async () => {
  if (isElectron()) {
    await electronRestartApp()
  }
}

// 開啟設定彈窗
const openSettings = () => {
  isOpen.value = true
}

// 暴露方法給外部使用
defineExpose({
  openSettings,
})

// 同步當前語系狀態（語系初始化已經在 App.vue 中完成，這裡只需要同步狀態）
const { locale } = useI18n()
watch(
  () => locale.value,
  (newLocale) => {
    selectedLanguage.value = newLocale as typeof selectedLanguage.value
  },
  { immediate: true },
)

// 監聽 menu 事件
onMounted(async () => {
  if (isElectron()) {
    // 載入硬體加速設定
    hardwareAcceleration.value = await getHardwareAcceleration()

    // 直接監聽 open-settings 事件
    onMainMessage((data: unknown) => {
      if (data === 'open-settings') {
        openSettings()
      }
    })
  }
})
</script>

<style scoped>
.v-card-title {
  background-color: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
}
</style>
