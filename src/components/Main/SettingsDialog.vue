<template>
  <v-dialog v-model="isOpen" max-width="700" @keydown.esc="isOpen = false">
    <v-card rounded="lg">
      <div class="d-flex flex-row settings-container">
        <!-- Left sidebar -->
        <div class="settings-sidebar">
          <v-list nav density="compact" class="py-2">
            <v-list-item
              v-for="category in categories"
              :key="category.id"
              :value="category.id"
              :active="activeCategory === category.id"
              active-class="bg-primary"
              rounded="lg"
              @click="activeCategory = category.id"
            >
              <template #prepend>
                <v-icon>{{ category.icon }}</v-icon>
              </template>
              <v-list-item-title>{{ $t(category.title) }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </div>

        <!-- Right content -->
        <div class="settings-content pa-3">
          <v-card-text class="settings-text">
            <!-- General -->
            <template v-if="activeCategory === 'general'">
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
                    rounded="lg"
                    :menu-props="{ contentClass: 'rounded-lg' }"
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
                    rounded="lg"
                    :menu-props="{ contentClass: 'rounded-lg' }"
                    @update:model-value="handleTimezoneChange"
                  ></v-select>
                </v-col>
                <v-col cols="12">
                  <v-label class="text-subtitle-1 mb-2">{{ $t('settings.theme') }}</v-label>
                  <v-switch
                    v-model="isDarkMode"
                    :label="$t('settings.darkMode')"
                    color="primary"
                    hide-details
                  ></v-switch>
                </v-col>
              </v-row>
            </template>

            <!-- Media -->
            <template v-if="activeCategory === 'media'">
              <!-- FFmpeg Status (always visible) -->
              <v-label class="text-subtitle-2 mb-2">{{
                $t('settings.media.ffmpegStatus')
              }}</v-label>
              <div class="mb-2">
                <v-chip
                  :color="ffmpegStatus.available ? 'success' : 'warning'"
                  size="small"
                  class="mb-2"
                >
                  {{
                    ffmpegStatus.available
                      ? $t('settings.media.ffmpegFound', { version: ffmpegStatus.version })
                      : $t('settings.media.ffmpegNotFound')
                  }}
                </v-chip>
              </div>
              <p v-if="ffmpegStatus.path" class="text-caption text-medium-emphasis mb-4">
                {{ ffmpegStatus.path }}
              </p>

              <!-- Custom Path Input (always visible) -->
              <v-text-field
                v-model="customFfmpegPath"
                :label="$t('settings.media.customFfmpegPath')"
                :placeholder="$t('settings.media.customFfmpegPathPlaceholder')"
                :hint="$t('settings.media.customFfmpegPathHint')"
                variant="outlined"
                density="compact"
                clearable
                persistent-hint
                class="mb-4"
                rounded="lg"
                @blur="handleCustomPathChange"
              />

              <!-- Enable FFmpeg Switch -->
              <div class="d-flex align-center mb-2">
                <v-switch
                  v-model="enableFfmpeg"
                  :label="$t('settings.media.enableExtendedVideo')"
                  :disabled="!ffmpegStatus.available"
                  color="primary"
                  hide-details
                  @update:model-value="handleEnableFfmpegChange"
                />
                <v-btn icon variant="text" size="small" @click="showInstallGuide = true">
                  <v-icon size="small">mdi-help-circle-outline</v-icon>
                </v-btn>
              </div>
              <p class="text-caption text-medium-emphasis mb-4">
                {{ $t('settings.media.enableExtendedVideoHint') }}
              </p>
              <p v-if="!ffmpegStatus.available" class="text-caption text-error mb-4">
                {{ $t('settings.media.ffmpegRequiredToEnable') }}
              </p>

              <!-- Video Quality (disabled when FFmpeg is OFF) -->
              <v-label class="text-subtitle-2 mb-2">{{ $t('settings.videoQuality') }}</v-label>
              <v-select
                v-model="videoQuality"
                :items="videoQualityOptions"
                :disabled="!enableFfmpeg"
                item-title="text"
                item-value="value"
                variant="outlined"
                density="compact"
                rounded="lg"
                :menu-props="{ contentClass: 'rounded-lg' }"
                @update:model-value="handleVideoQualityChange"
              >
                <template v-slot:item="{ props, item }">
                  <v-list-item v-bind="props" :title="$t(item.raw.text)">
                    <template v-slot:subtitle>
                      {{ $t(item.raw.description) }}
                    </template>
                  </v-list-item>
                </template>
                <template v-slot:selection="{ item }">
                  {{ $t(item.raw.text) }}
                </template>
              </v-select>
              <p class="text-caption text-medium-emphasis mt-1">
                {{ $t('settings.videoQualityHint') }}
              </p>
            </template>

            <!-- System -->
            <template v-if="activeCategory === 'system'">
              <v-row>
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
            </template>

            <!-- About -->
            <template v-if="activeCategory === 'about'">
              <div class="text-center py-4">
                <v-icon size="64" color="primary" class="mb-4">mdi-church</v-icon>
                <h3 class="text-h6 mb-2">HHC Client</h3>
                <p class="text-body-2 text-medium-emphasis mb-4">
                  {{ $t('about.version') }}: {{ appVersion }}
                </p>
                <p class="text-body-2 text-medium-emphasis mb-4">
                  {{ $t('about.descriptionText') }}
                </p>
                <v-divider class="my-4" />
                <p class="text-caption text-medium-emphasis">
                  {{ $t('about.copyright') }}
                </p>
              </div>
            </template>
          </v-card-text>

          <v-card-actions class="settings-actions">
            <v-spacer></v-spacer>
            <v-btn @click="isOpen = false" rounded="xl" size="large">
              {{ $t('common.close') }}
            </v-btn>
          </v-card-actions>
        </div>
      </div>
    </v-card>
  </v-dialog>

  <!-- Restart Required Dialog -->
  <v-dialog v-model="showRestartDialog" max-width="400" persistent>
    <v-card rounded="lg">
      <v-card-title class="text-subtitle-1">
        {{ $t('settings.restartRequired') }}
      </v-card-title>
      <v-card-text>
        {{ $t('settings.restartRequiredMessage') }}
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn variant="text" rounded="lg" @click="showRestartDialog = false">
          {{ $t('common.later') }}
        </v-btn>
        <v-btn color="primary" variant="flat" rounded="lg" @click="restartApp">
          {{ $t('common.restartNow') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <FFmpegInstallGuideDialog v-model="showInstallGuide" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTimerStore } from '@/stores/timer'
import { useElectron } from '@/composables/useElectron'
import { useDarkMode } from '@/composables/useDarkMode'
import { useLocaleDetection } from '@/composables/useLocaleDetection'
import { useProjectionManager } from '@/composables/useProjectionManager'
import { useSettingsStore } from '@/stores/settings'
import FFmpegInstallGuideDialog from './FFmpegInstallGuideDialog.vue'
import type { FFmpegStatus } from '@/types/electron'

// Declare __APP_VERSION__ if not available globally
declare const __APP_VERSION__: string

// i18n
const { t: $t, t } = useI18n()

// Electron composable
const {
  isElectron,
  onMainMessage,
  getHardwareAcceleration,
  setHardwareAcceleration,
  getVideoQuality,
  setVideoQuality,
  restartApp: electronRestartApp,
  getEnableFfmpeg,
  setEnableFfmpeg,
  ffmpegCheckStatus,
  ffmpegSetPath,
} = useElectron()

// 投影消息管理
const { syncAllStates } = useProjectionManager()

// Settings store for FFmpeg status
const settingsStore = useSettingsStore()

// 設定彈窗狀態
const isOpen = ref(false)

// Categories
const categories = [
  { id: 'general', title: 'settings.categories.general', icon: 'mdi-cog' },
  { id: 'media', title: 'settings.categories.media', icon: 'mdi-video' },
  { id: 'system', title: 'settings.categories.system', icon: 'mdi-tune' },
  { id: 'about', title: 'settings.categories.about', icon: 'mdi-information' },
]
const activeCategory = ref('general')

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

// Video quality 設定
const videoQuality = ref<'low' | 'medium' | 'high'>('high')
const videoQualityOptions = [
  {
    text: 'settings.videoQualityOptions.high',
    value: 'high',
    description: 'settings.videoQualityOptions.highDesc',
  },
  {
    text: 'settings.videoQualityOptions.medium',
    value: 'medium',
    description: 'settings.videoQualityOptions.mediumDesc',
  },
  {
    text: 'settings.videoQualityOptions.low',
    value: 'low',
    description: 'settings.videoQualityOptions.lowDesc',
  },
]

// FFmpeg Settings
const enableFfmpeg = ref(false)
const ffmpegStatus = ref<FFmpegStatus>({ available: false, path: '', version: '', error: '' })
const customFfmpegPath = ref('')
const showInstallGuide = ref(false)

// App Version
// Use try-catch or safer access if __APP_VERSION__ is not defined in certain envs (like testing)
let appVersion = '1.0.0'
try {
  appVersion = __APP_VERSION__ ?? '1.0.0'
} catch {
  // Ignore error if variable is not defined
}

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

// 處理影片品質變更
const handleVideoQualityChange = async (quality: 'low' | 'medium' | 'high') => {
  if (isElectron()) {
    await setVideoQuality(quality)
  }
}

// Handle Enable FFmpeg toggle
const handleEnableFfmpegChange = async (enabled: boolean | null) => {
  if (isElectron() && enabled !== null) {
    // Only allow enabling if FFmpeg is available
    if (enabled && !ffmpegStatus.value.available) {
      enableFfmpeg.value = false
      return
    }
    await setEnableFfmpeg(enabled)
    await settingsStore.updateFfmpegStatus()
  }
}

// Handle custom path change
const handleCustomPathChange = async () => {
  if (isElectron()) {
    // Always re-check status when path changes (even if empty - will check system PATH)
    ffmpegStatus.value = await ffmpegSetPath(customFfmpegPath.value || '')

    // If detection succeeds and switch is on, update store
    if (ffmpegStatus.value.available && enableFfmpeg.value) {
      await settingsStore.updateFfmpegStatus()
    }
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

    // 載入影片品質設定
    videoQuality.value = await getVideoQuality()

    // Check FFmpeg status first (regardless of switch state)
    ffmpegStatus.value = await ffmpegCheckStatus()

    // Then load FFmpeg switch state
    enableFfmpeg.value = await getEnableFfmpeg()

    // 直接監聯 open-settings 事件
    onMainMessage((data: unknown) => {
      if (data === 'open-settings') {
        openSettings()
      }
    })
  }
})
</script>

<style scoped>
/* Settings Container */
.settings-container {
  height: 600px;
  max-height: 80vh;
}

/* Left Sidebar */
.settings-sidebar {
  width: 180px;
  flex-shrink: 0;
  border-right: 1px solid rgb(var(--v-theme-outline-variant));
}

/* Right Content Area */
.settings-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

/* Title - Fixed at top */
.settings-title {
  flex-shrink: 0;
  background-color: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
}

/* Content - Scrollable */
.settings-text {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* Actions - Fixed at bottom */
.settings-actions {
  flex-shrink: 0;
  border-top: 1px solid rgb(var(--v-theme-outline-variant));
}
</style>
