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
        </v-row>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="isOpen = false"> {{ $t('close') }} </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTimerStore } from '@/stores/timer'
import { useElectron } from '@/composables/useElectron'
import { useDarkMode } from '@/composables/useDarkMode'
import { useProjectionMessaging } from '@/composables/useProjectionMessaging'

// i18n
const { t: $t, t, locale } = useI18n()

// Electron composable
const { isElectron } = useElectron()

// 投影消息管理
const { sendTimerUpdate, sendThemeUpdate } = useProjectionMessaging()

// 設定彈窗狀態
const isOpen = ref(false)

// 語系選擇
const selectedLanguage = ref(locale.value)
const languageOptions = [
  { value: 'zh', text: 'settings.chinese' },
  // { value: 'en', text: 'settings.english' },
]

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
      sendThemeUpdate()
    }
  },
})

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
  sendTimerUpdate()
}

// 處理語系切換
const handleLanguageChange = async (newLocale: string) => {
  locale.value = newLocale
  selectedLanguage.value = newLocale
  // 保存到 localStorage
  localStorage.setItem('preferred-language', newLocale)

  // 通知主進程更新語系
  if (isElectron()) {
    try {
      await window.electronAPI.updateLanguage(newLocale)
    } catch (error) {
      console.error('更新語系失敗:', error)
    }
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

// 監聽 menu 事件
onMounted(() => {
  if (isElectron()) {
    // 直接監聽 open-settings 事件
    window.electronAPI.onMainMessage((data: unknown) => {
      if (data === 'open-settings') {
        openSettings()
      }
    })
  }

  // 從 localStorage 讀取保存的語系設定
  const savedLanguage = localStorage.getItem('preferred-language')
  if (savedLanguage) {
    locale.value = savedLanguage
    selectedLanguage.value = savedLanguage
  }
})
</script>

<style scoped>
.v-card-title {
  background-color: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
}
</style>
