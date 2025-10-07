<template>
  <v-layout class="rounded rounded-md">
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

    <extended-toolbar
      :current-view="currentView"
      :drawer-collapsed="drawerCollapsed"
      @toggle-drawer="toggleDrawer"
    />

    <v-main>
      <v-container>
        <transition name="page-slide" mode="out-in">
          <component :is="currentComponent" :key="currentView" />
        </transition>
      </v-container>
    </v-main>
  </v-layout>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import ExtendedToolbar from '@/components/ExtendedToolbar.vue'
import BibleViewer from '@/components/Bible/BibleViewer.vue'
import TimerControl from '@/layouts/control/TimerControl.vue'
import { useElectron } from '@/composables/useElectron'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useProjectionStore } from '@/stores/projection'
import { useAlert } from '@/composables/useAlert'
import { MessageType, ViewType, type AppMessage } from '@/types/common'

// i18n
const { t: $t } = useI18n()

// Projection store
const projectionStore = useProjectionStore()

// Alert
const { warning } = useAlert()

// Electron composable
const {
  isElectron,
  sendToProjection,
  onMainMessage,
  onNoSecondScreenDetected,
  checkProjectionWindow,
  ensureProjectionWindow,
  removeAllListeners,
} = useElectron()

// 控制 navigation-drawer 的開關狀態，預設為開啟 (true)
const drawer = ref(true)

// 控制 drawer 的縮放狀態，預設為展開 (false)
const drawerCollapsed = ref(false)

// 當前選中的視圖
const currentView = ref('bible') // 預設使用聖經

// 鍵盤快捷鍵
useKeyboardShortcuts(currentView)

// 選單項目配置
const menuItems = ref([
  {
    title: 'bible',
    icon: 'mdi-book-open-variant',
    component: 'bible',
  },
  {
    title: 'timerControl',
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

// 處理選單項目點擊事件
const handleMenuItemClick = (item: { title: string; icon: string; component: string }) => {
  currentView.value = item.component
  // 不再自動關閉側邊欄，因為現在是常駐模式

  // 發送消息到投影窗口
  sendToProjection({
    type: MessageType.CHANGE_VIEW,
    data: { view: item.component as ViewType },
  })
}

// 監聽來自Electron的消息
const handleElectronMessage = (data: AppMessage) => {
  if (data.type === MessageType.GET_CURRENT_STATE) {
    // 發送當前狀態到投影窗口
    sendToProjection({
      type: MessageType.CHANGE_VIEW,
      data: { view: currentView.value as ViewType },
    })
  }
}

// 處理沒有第二螢幕的提示
const handleNoSecondScreen = async () => {
  await warning($t('alert.dualScreenRequired'), $t('alert.screenWarning'))
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
      console.error('Error checking projection window:', error)
    }
  }
}

// 監聽視圖切換，當切換到計時頁面時自動開啟投影內容
watch(currentView, async (newView) => {
  if (newView === 'timer' && isElectron()) {
    // 確保投影視窗存在
    await checkAndEnsureProjectionWindow()

    // 如果投影內容是關閉的（顯示預設畫面），自動開啟
    if (projectionStore.isShowingDefault) {
      // 更新 store 狀態
      projectionStore.setShowingDefault(false)
      projectionStore.setCurrentView('timer')

      // 發送消息到投影視窗
      sendToProjection({
        type: MessageType.TOGGLE_PROJECTION_CONTENT,
        data: { showDefault: false },
      })

      sendToProjection({
        type: MessageType.CHANGE_VIEW,
        data: { view: ViewType.TIMER },
      })
    }
  }
})

// 生命週期
onMounted(async () => {
  if (isElectron()) {
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
