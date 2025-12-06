<template>
  <v-layout class="rounded rounded-md">
    <extended-toolbar
      :current-view="currentView"
      :drawer-collapsed="drawerCollapsed"
      @toggle-drawer="toggleDrawer"
    />

    <v-navigation-drawer
      v-model="drawer"
      permanent
      :rail="drawerCollapsed"
      rail-width="72"
      width="240"
      class="custom-drawer"
    >
      <v-list>
        <v-list-item
          v-for="(item, index) in menuItems"
          :key="index"
          :value="index"
          @click="handleMenuItemClick(item)"
          :active="currentView === item.component"
          class="menu-item"
        >
          <template #prepend>
            <v-icon :icon="item.icon" size="24"></v-icon>
          </template>
          <v-list-item-title v-if="!drawerCollapsed">{{ $t(item.title) }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <!-- Main content -->
    <v-main>
      <transition name="page-slide" mode="out-in">
        <component :is="currentComponent" :key="currentView" />
      </transition>
    </v-main>

    <!-- Extended Components -->
    <FloatingTimer v-if="showFloatingTimer" @click="goToTimer" />

    <!-- Global Alert Dialog -->
    <AlertDialog
      v-model="alertState.show"
      :title="alertState.title"
      :message="alertState.message"
      :icon="alertState.icon"
      :icon-color="alertState.iconColor"
      :confirm-button-text="alertState.confirmButtonText"
      :confirm-button-color="alertState.confirmButtonColor"
      :cancel-button-text="alertState.cancelButtonText"
      :cancel-button-color="alertState.cancelButtonColor"
      :show-cancel-button="alertState.showCancelButton"
      :max-width="alertState.maxWidth"
      :show-dont-show-again="alertState.showDontShowAgain"
      :alert-id="alertState.alertId"
      @confirm="confirm"
      @cancel="cancel"
      @dont-show-again="handleDontShowAgain"
    />

    <!-- Update Notification -->
    <UpdateNotification />

    <!-- Global SnackBar -->
    <SnackBar
      v-model="snackbarVisible"
      :text="snackbarText"
      :timeout="snackbarTimeout"
      :color="snackbarColor"
      :location="defaultConfig.location"
      :variant="defaultConfig.variant"
    />

    <!-- Global Settings Dialog -->
    <SettingsDialog />

    <!-- Global Shortcuts Dialog -->
    <ShortcutsDialog />

    <!-- Global About Dialog -->
    <AboutDialog />

    <!-- Global Reset Dialog -->
    <ResetDialog />
  </v-layout>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import ExtendedToolbar from '@/components/ExtendedToolbar.vue'
import BibleViewer from '@/layouts/control/BibleControl.vue'
import TimerControl from '@/layouts/control/TimerControl.vue'
import FloatingTimer from '@/components/Timer/FloatingTimer.vue'
import { useElectron } from '@/composables/useElectron'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { AlertDialog, SnackBar } from '@/components/Alert'
import { UpdateNotification } from '@/components/Updater'
import { SettingsDialog, AboutDialog, ResetDialog } from '@/components/Main'
import { ShortcutsDialog } from '@/components/Shortcuts'
import { useAlert } from '@/composables/useAlert'
import { useSnackBar } from '@/composables/useSnackBar'
import { useTimerStore } from '@/stores/timer'
import { useProjectionMessaging } from '@/composables/useProjectionMessaging'
import { MessageType, ViewType, type AppMessage } from '@/types/common'
import { useSentry } from '@/composables/useSentry'
import { useProjectionStore } from '@/stores/projection'
import { getInitialLocale } from '@/composables/useLocaleDetection'

// Composable
const { t: $t, locale } = useI18n()
const { reportError } = useSentry()
const { alertState, confirm, cancel, handleDontShowAgain, warning } = useAlert()
const { snackbarVisible, snackbarText, snackbarColor, snackbarTimeout, defaultConfig } =
  useSnackBar()
const { sendViewChange } = useProjectionMessaging()

// Store
const timerStore = useTimerStore()
const projectionStore = useProjectionStore()

// Electron composable
const {
  isElectron,
  onMainMessage,
  onNoSecondScreenDetected,
  checkProjectionWindow,
  ensureProjectionWindow,
  removeAllListeners,
} = useElectron()

// 控制 navigation-drawer 的開關狀態，預設為開啟 (true)
const drawer = ref(true)

// 控制 drawer 的縮放狀態，預設為收起 (true)
const drawerCollapsed = ref(true)

// 當前選中的視圖
const currentView = ref(ViewType.BIBLE) // 預設使用聖經

// 懸浮計時器顯示狀態
const showFloatingTimer = computed(() => {
  // 只有在計時器運行中且不在計時器頁面時才顯示
  return timerStore.isRunning && currentView.value !== ViewType.TIMER
})

useKeyboardShortcuts(currentView)

// 選單項目配置
const menuItems = ref([
  {
    title: 'bible.title',
    icon: 'mdi-book-open-variant',
    component: 'bible',
  },
  {
    title: 'timer.title',
    icon: 'mdi-clock-outline',
    component: 'timer',
  },
])

// 組件映射
const componentMap = {
  bible: BibleViewer,
  timer: TimerControl,
}

// 當前組件
const currentComponent = computed(() => {
  return componentMap[currentView.value as keyof typeof componentMap]
})

// 切換 drawer 縮放狀態
const toggleDrawer = () => {
  drawerCollapsed.value = !drawerCollapsed.value
}

// 點擊懸浮計時器跳轉到計時器頁面
const goToTimer = () => {
  currentView.value = ViewType.TIMER
  projectionStore.setCurrentView(currentView.value)
  sendViewChange(ViewType.TIMER, true)
}

// 處理選單項目點擊事件
const handleMenuItemClick = (item: { title: string; icon: string; component: string }) => {
  currentView.value = item.component as ViewType
  if (item.component === ViewType.TIMER) {
    projectionStore.setCurrentView(ViewType.TIMER)
    sendViewChange(ViewType.TIMER, true)
  }
}

// 監聽來自Electron的消息
const handleElectronMessage = (data: AppMessage) => {
  if (data.type === MessageType.GET_CURRENT_STATE) {
    sendViewChange(currentView.value as ViewType, true)
  }
}

// 處理沒有第二螢幕的提示
const handleNoSecondScreen = async () => {
  await warning($t('alert.dualScreenRequired'), $t('alert.screenWarning'), {
    showDontShowAgain: true,
    alertId: 'no-second-screen-warning',
  })
}

// 檢查並確保投影窗口存在
const checkAndEnsureProjectionWindow = async () => {
  if (isElectron()) {
    try {
      const projectionExists = await checkProjectionWindow()
      if (!projectionExists) {
        await ensureProjectionWindow()
      }
    } catch (error) {
      reportError(error, {
        operation: 'check-projection-window',
        component: 'HomeView',
      })
    }
  }
}

// 監聽視圖切換
watch(currentView, async () => {})

// 生命週期
onMounted(async () => {
  // 初始化語系偵測
  const initialLocale = await getInitialLocale()
  locale.value = initialLocale

  if (isElectron()) {
    try {
      await window.electronAPI.updateLanguage(initialLocale)
    } catch (error) {
      console.error('Failed to sync language to Electron:', error)
    }

    // 監聽來自Electron的消息
    onMainMessage(handleElectronMessage)

    // 監聽沒有第二螢幕的事件
    onNoSecondScreenDetected(handleNoSecondScreen)

    // 檢查並確保投影窗口存在
    await checkAndEnsureProjectionWindow()
  }
})

onBeforeUnmount(() => {
  if (isElectron()) {
    removeAllListeners('main-message')
    removeAllListeners('no-second-screen-detected')
  }
})
</script>

<style scoped>
.page-slide-enter-active,
.page-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.page-slide-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.page-slide-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.page-slide-enter-to,
.page-slide-leave-from {
  opacity: 1;
  transform: translateX(0);
}

/* 自定義 drawer 樣式 */
.custom-drawer {
  transition: width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.menu-item {
  transition: all 0.2s ease;
  border-radius: 8px;
  margin: 4px 8px;
}

.menu-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.1);
}

.menu-item.v-list-item--active {
  background-color: rgba(var(--v-theme-primary), 0.2);
  color: rgb(var(--v-theme-primary));
}

.menu-item.v-list-item--active .v-icon {
  color: rgb(var(--v-theme-primary));
}
</style>
