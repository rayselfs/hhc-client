<template>
  <v-toolbar dark prominent>
    <v-app-bar-nav-icon @click="emitToggleDrawer" />
    <v-toolbar-title class="text-h5">{{ toolbarTitle }}</v-toolbar-title>
    <v-spacer />

    <v-slide-x-reverse-transition>
      <v-text-field
        v-if="isSearching"
        v-model="searchQuery"
        autofocus
        variant="solo-inverted"
        hide-details
        :placeholder="$t('search')"
        density="compact"
        class="mr-2"
        style="width: 250px"
        @keydown.esc="closeSearch"
      />
    </v-slide-x-reverse-transition>

    <v-btn v-if="!isSearching" icon @click="isSearching = true">
      <v-icon>mdi-magnify</v-icon>
    </v-btn>

    <v-btn v-else icon @click="closeSearch">
      <v-icon>mdi-close</v-icon>
    </v-btn>

    <v-btn
      icon
      @click="toggleProjectionContent"
      :color="!projectionStore.isShowingDefault ? 'error' : 'default'"
      :title="projectionStore.isShowingDefault ? $t('showContent') : $t('showDefault')"
    >
      <v-icon v-if="projectionStore.isShowingDefault">mdi-monitor</v-icon>
      <v-icon v-else>mdi-monitor-off</v-icon>
    </v-btn>

    <v-menu>
      <template v-slot:activator="{ props }">
        <v-btn icon v-bind="props">
          <v-icon>mdi-dots-vertical</v-icon>
        </v-btn>
      </template>

      <v-list>
        <v-list-item @click="openSettings">
          <template v-slot:prepend>
            <v-icon>mdi-cog</v-icon>
          </template>
          <v-list-item-title>{{ $t('settings') }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>

    <!-- 設定彈窗 -->
    <v-dialog v-model="isSettingsOpen" max-width="500">
      <v-card>
        <v-card-title>
          <v-icon class="mr-2">mdi-cog</v-icon>
          {{ $t('settings') }}
        </v-card-title>

        <v-card-text>
          <v-row>
            <v-col cols="12">
              <v-label class="text-subtitle-1 mb-2">{{ $t('languageSettings') }}</v-label>
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
              <v-label class="text-subtitle-1 mb-2">{{ $t('timezoneSettings') }}</v-label>
              <v-select
                v-model="selectedTimezone"
                :items="timezones"
                variant="outlined"
                density="compact"
                @update:model-value="handleTimezoneChange"
              ></v-select>
            </v-col>
            <v-col cols="12">
              <v-label class="text-subtitle-1 mb-2">{{ $t('themeSettings') }}</v-label>
              <v-switch v-model="isDarkMode" :label="$t('darkMode')" color="primary"></v-switch>
            </v-col>
          </v-row>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="isSettingsOpen = false"> {{ $t('close') }} </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-toolbar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTimerStore } from '@/stores/timer'
import { useProjectionStore } from '@/stores/projection'
import { useElectron } from '@/composables/useElectron'
import { useDarkMode } from '@/composables/useDarkMode'
import { MessageType } from '@/types/common'

// i18n
const { t: $t, locale } = useI18n()

// Electron composable
const {
  isElectron,
  sendToProjection: electronSendToProjection,
  onProjectionOpened,
  onProjectionClosed,
} = useElectron()

// Props
const props = defineProps<{
  currentView: string
}>()

// Drawer 的事件發送
const emit = defineEmits<{
  (e: 'toggle-drawer'): void
}>()

// 計算標題
const toolbarTitle = computed(() => {
  switch (props.currentView) {
    case 'bible':
      return $t('bible')
    case 'timer':
      return $t('timer')
    default:
      return 'HHC Project Client'
  }
})

const emitToggleDrawer = () => {
  emit('toggle-drawer')
}

// 搜尋功能的狀態
const isSearching = ref(false)
const searchQuery = ref('')

const closeSearch = () => {
  isSearching.value = false
  searchQuery.value = ''
}

// 投影功能

// 設定彈窗
const isSettingsOpen = ref(false)

// 語系選擇
const selectedLanguage = ref(locale.value)
const languageOptions = [
  { value: 'zh', text: 'chinese' },
  { value: 'en', text: 'english' },
]

// 開啟設定彈窗
const openSettings = () => {
  isSettingsOpen.value = true
}

// 時區設定
const timerStore = useTimerStore()
const projectionStore = useProjectionStore()
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

// 時區選項
const timezones = [
  { title: '台北時間 (UTC+8)', value: 'Asia/Taipei' },
  { title: '香港時間 (UTC+8)', value: 'Asia/Hong_Kong' },
  { title: '新加坡時間 (UTC+8)', value: 'Asia/Singapore' },
  { title: '東京時間 (UTC+9)', value: 'Asia/Tokyo' },
  { title: '首爾時間 (UTC+9)', value: 'Asia/Seoul' },
  { title: '紐約時間 (UTC-5)', value: 'America/New_York' },
  { title: '倫敦時間 (UTC+0)', value: 'Europe/London' },
  { title: '巴黎時間 (UTC+1)', value: 'Europe/Paris' },
  { title: 'UTC時間', value: 'UTC' },
]

// 處理時區變更
const handleTimezoneChange = (timezone: string) => {
  timerStore.setTimezone(timezone)
  sendToProjection()
}

// 發送主題更新到投影窗口
const sendThemeUpdate = () => {
  if (isElectron()) {
    electronSendToProjection({
      type: MessageType.UPDATE_THEME,
      data: {
        isDark: isDark.value,
      },
    })
  }
}

// 發送消息到投影窗口
const sendToProjection = () => {
  if (isElectron()) {
    electronSendToProjection({
      type: MessageType.UPDATE_TIMER,
      data: {
        mode: timerStore.settings.mode,
        timerDuration: timerStore.settings.timerDuration,
        timezone: timerStore.settings.timezone,
        isRunning: timerStore.settings.isRunning,
        remainingTime: timerStore.settings.remainingTime,
        formattedTime: timerStore.formattedTime,
        progress: timerStore.progress,
      },
    })
  }
}

// 切換投影內容
const toggleProjectionContent = () => {
  projectionStore.toggleProjectionContent()
  sendProjectionToggle()
}

// 發送投影切換消息
const sendProjectionToggle = () => {
  if (isElectron()) {
    electronSendToProjection({
      type: MessageType.TOGGLE_PROJECTION_CONTENT,
      data: { showDefault: projectionStore.isShowingDefault },
    })
  }
}

// 處理語系切換
const handleLanguageChange = (newLocale: string) => {
  locale.value = newLocale
  selectedLanguage.value = newLocale
  // 保存到 localStorage
  localStorage.setItem('preferred-language', newLocale)
}

onMounted(() => {
  // 初始化時發送當前狀態
  sendProjectionToggle()

  // 從 localStorage 讀取保存的語系設定
  const savedLanguage = localStorage.getItem('preferred-language')
  if (savedLanguage && (savedLanguage === 'zh' || savedLanguage === 'en')) {
    locale.value = savedLanguage
    selectedLanguage.value = savedLanguage
  }

  // 監聽投影窗口狀態變化
  if (isElectron()) {
    onProjectionOpened(() => {
      // 投影窗口開啟時，預設顯示預設內容（投影關閉狀態）
      projectionStore.setShowingDefault(true)
    })

    onProjectionClosed(() => {
      // 投影窗口關閉時，重置為預設內容狀態
      projectionStore.setShowingDefault(true)
    })
  }
})
</script>
