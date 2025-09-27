<template>
  <v-app>
    <extended-toolbar :current-view="currentView" @toggle-drawer="drawer = !drawer" />

    <v-navigation-drawer v-model="drawer" temporary>
      <v-list>
        <v-list-item
          v-for="(item, index) in menuItems"
          :key="index"
          :value="index"
          @click="handleMenuItemClick(item)"
          :active="currentView === item.component"
        >
          <template #prepend>
            <v-icon :icon="item.icon"></v-icon>
          </template>
          <v-list-item-title>{{ $t(item.title) }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <v-container>
        <transition name="page-slide" mode="out-in">
          <component :is="currentComponent" :key="currentView" />
        </transition>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import ExtendedToolbar from '@/components/ExtendedToolbar.vue'
import BibleViewer from '@/components/Bible/BibleViewer.vue'
import TimerControl from '@/components/Timer/TimerControl.vue'
import { useElectron } from '@/composables/useElectron'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { MessageType, ViewType, type AppMessage } from '@/types/common'

// i18n
const { t: $t } = useI18n()

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

// 控制 navigation-drawer 的開關狀態，預設為關閉 (false)
const drawer = ref(false)

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

// 處理選單項目點擊事件
const handleMenuItemClick = (item: { title: string; icon: string; component: string }) => {
  currentView.value = item.component
  drawer.value = false // 點擊任何項目後自動關閉側邊欄

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
const handleNoSecondScreen = () => {
  alert('此App是設計用在雙螢幕')
}

// 檢查並確保投影窗口存在
const checkAndEnsureProjectionWindow = async () => {
  if (isElectron()) {
    try {
      const projectionExists = await checkProjectionWindow()
      if (!projectionExists) {
        console.log('Projection window not found, recreating...')
        await ensureProjectionWindow()
        console.log('Projection window recreated successfully')
      }
    } catch (error) {
      console.error('Error checking projection window:', error)
    }
  }
}

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
/* 頁面切換動畫 */
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
</style>
