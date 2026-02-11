<template>
  <v-dialog
    v-model="isOpen"
    max-width="700"
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-title"
    @keydown.esc="isOpen = false"
  >
    <v-card rounded="rounded-xl">
      <div class="d-flex flex-row settings-container">
        <!-- Left sidebar with macOS Finder style -->
        <div class="settings-sidebar">
          <h2 id="settings-title" class="v-sr-only">{{ $t('settings.title') }}</h2>
          <liquid-container mode="simple" padding="pa-0 py-2" class="sidebar-container">
            <div class="py-1" role="tablist" aria-orientation="vertical">
              <v-list-item
                v-for="category in CATEGORIES"
                :key="category.id"
                padding="py-1 px-3"
                rounded="rounded-lg"
                :selected="activeCategory === category.id"
                :show-selected-border="false"
                :selected-opacity="0.15"
                :hover-opacity="0.1"
                color="surface"
                class="mx-1 mb-1"
                role="tab"
                :aria-selected="activeCategory === category.id"
                :aria-controls="'panel-' + category.id"
                @click="activeCategory = category.id"
              >
                <template #prepend>
                  <v-icon size="small">{{ category.icon }}</v-icon>
                </template>
                <span class="text-body-2">{{ $t(category.title) }}</span>
              </v-list-item>
            </div>
          </liquid-container>
        </div>

        <!-- Right content -->
        <div class="settings-content">
          <div
            class="pa-4"
            role="tabpanel"
            :id="'panel-' + activeCategory"
            :aria-labelledby="'tab-' + activeCategory"
          >
            <GeneralSettings
              v-if="activeCategory === 'general'"
              v-model:selected-language="selectedLanguage"
              v-model:selected-timezone="selectedTimezone"
              v-model:is-dark-mode="isDarkMode"
              :language-options="languageOptions"
              :timezones="timezones"
              @language-change="handleLanguageChange"
              @timezone-change="handleTimezoneChange"
            />

            <MediaSettings
              v-if="activeCategory === 'media'"
              v-model:custom-ffmpeg-path="customFfmpegPath"
              v-model:enable-ffmpeg="enableFfmpeg"
              v-model:video-quality="videoQuality"
              :ffmpeg-status="ffmpegStatus"
              :video-quality-options="VIDEO_QUALITY_OPTIONS"
              @custom-path-change="handleCustomPathChange"
              @enable-ffmpeg-change="handleEnableFfmpegChange"
              @video-quality-change="handleVideoQualityChange"
              @show-install-guide="showInstallGuide = true"
            />

            <SystemSettings
              v-if="activeCategory === 'system'"
              v-model:hardware-acceleration="hardwareAcceleration"
              @hardware-acceleration-change="handleHardwareAccelerationChange"
            />
          </div>

          <v-card-actions class="settings-actions">
            <v-spacer></v-spacer>
            <liquid-btn @click="isOpen = false">
              {{ $t('common.close') }}
            </liquid-btn>
          </v-card-actions>
        </div>
      </div>
    </v-card>
  </v-dialog>

  <!-- Restart Required Dialog -->
  <v-dialog v-model="showRestartDialog" max-width="400" persistent>
    <v-card rounded="rounded-lg">
      <v-card-title class="text-subtitle-1">
        {{ $t('settings.restartRequired') }}
      </v-card-title>
      <v-card-text>
        {{ $t('settings.restartRequiredMessage') }}
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <liquid-btn variant="text" @click="showRestartDialog = false">
          {{ $t('common.later') }}
        </liquid-btn>
        <liquid-btn color="primary" @click="restartApp">
          {{ $t('common.restartNow') }}
        </liquid-btn>
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
import { GeneralSettings, MediaSettings, SystemSettings } from './Settings'
import FFmpegInstallGuideDialog from './FFmpegInstallGuideDialog.vue'
import { CATEGORIES, VIDEO_QUALITY_OPTIONS, getTimezoneOptions } from '@/config/settings'
import type { FFmpegStatus } from '@/types/electron'

const { t: $t, t } = useI18n()

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

const { syncAllStates } = useProjectionManager()
const settingsStore = useSettingsStore()
const isOpen = ref(false)
const activeCategory = ref('general')

const { selectedLanguage, languageOptions, handleLanguageChange } = useLocaleDetection()

const timerStore = useTimerStore()
const selectedTimezone = ref(timerStore.settings.timezone)

const { isDark, toggleDark } = useDarkMode()
const isDarkMode = computed({
  get: () => isDark.value,
  set: (value: boolean) => {
    if (value !== isDark.value) {
      toggleDark()
    }
  },
})

const hardwareAcceleration = ref(true)
const showRestartDialog = ref(false)
const videoQuality = ref<'low' | 'medium' | 'high'>('high')

const enableFfmpeg = ref(false)
const ffmpegStatus = ref<FFmpegStatus>({ available: false, path: '', version: '', error: '' })
const customFfmpegPath = ref('')
const showInstallGuide = ref(false)
const timezones = computed(() => getTimezoneOptions(t))

const handleTimezoneChange = (timezone: string) => {
  timerStore.setTimezone(timezone)
  syncAllStates()
}

const handleHardwareAccelerationChange = async (enabled: boolean) => {
  if (isElectron()) {
    await setHardwareAcceleration(enabled)
    showRestartDialog.value = true
  }
}

const handleVideoQualityChange = async (quality: 'low' | 'medium' | 'high') => {
  if (isElectron()) {
    await setVideoQuality(quality)
  }
}

const handleEnableFfmpegChange = async (enabled: boolean) => {
  if (isElectron()) {
    if (enabled && !ffmpegStatus.value.available) {
      enableFfmpeg.value = false
      return
    }
    await setEnableFfmpeg(enabled)
    await settingsStore.updateFfmpegStatus()
  }
}

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

const restartApp = async () => {
  if (isElectron()) {
    await electronRestartApp()
  }
}

const openSettings = () => {
  isOpen.value = true
}

defineExpose({
  openSettings,
})

const { locale } = useI18n()
watch(
  () => locale.value,
  (newLocale) => {
    selectedLanguage.value = newLocale as typeof selectedLanguage.value
  },
  { immediate: true },
)

onMounted(async () => {
  if (isElectron()) {
    hardwareAcceleration.value = await getHardwareAcceleration()
    videoQuality.value = await getVideoQuality()
    ffmpegStatus.value = await ffmpegCheckStatus()
    enableFfmpeg.value = await getEnableFfmpeg()

    onMainMessage((data: unknown) => {
      if (data === 'open-settings') {
        openSettings()
      }
    })
  }
})
</script>

<style scoped lang="scss">
.settings-container {
  height: 500px;
  max-height: 80vh;
}

.settings-sidebar {
  width: 180px;
  flex-shrink: 0;
  padding: 12px;
  display: flex;
  flex-direction: column;
}

.sidebar-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-radius: 14px !important;
}

.settings-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.settings-actions {
  flex-shrink: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
</style>
