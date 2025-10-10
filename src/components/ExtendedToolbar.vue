<template>
  <v-app-bar dark prominent>
    <v-app-bar-nav-icon @click="emitToggleDrawer">
      <v-icon>{{ drawerCollapsed ? 'mdi-menu' : 'mdi-menu-open' }}</v-icon>
    </v-app-bar-nav-icon>
    <v-app-bar-title class="text-h5">{{ toolbarTitle }}</v-app-bar-title>
    <v-spacer />

    <v-slide-x-reverse-transition>
      <v-text-field
        v-if="isSearching && showSearch"
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

    <v-btn
      v-if="!isSearching && showSearch"
      icon
      @click="isSearching = true"
      :title="$t('search')"
      class="mr-1"
    >
      <v-icon>mdi-magnify</v-icon>
    </v-btn>

    <v-btn v-else-if="isSearching && showSearch" icon @click="closeSearch">
      <v-icon>mdi-close</v-icon>
    </v-btn>

    <v-btn
      class="mr-1"
      @click="toggleProjectionContent"
      :color="!projectionStore.isShowingDefault ? 'error' : 'default'"
      :title="
        projectionStore.isShowingDefault
          ? $t('open') + $t('projection.title')
          : $t('close') + $t('projection.title')
      "
      variant="outlined"
    >
      <v-icon v-if="projectionStore.isShowingDefault" class="mr-2">mdi-monitor</v-icon>
      <v-icon v-else class="mr-2">mdi-monitor-off</v-icon>
      {{ $t('projection.title') }}
    </v-btn>

    <v-btn
      class="mr-4"
      @click="closeProjectionWindow"
      color="error"
      :title="$t('close') + $t('projection.title') + $t('window')"
      icon
    >
      <v-icon>mdi-close</v-icon>
    </v-btn>
  </v-app-bar>

  <!-- 使用 AlertDialog 組件 -->
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
    @confirm="confirm"
    @cancel="cancel"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectionStore } from '@/stores/projection'
import { useElectron } from '@/composables/useElectron'
import { useProjectionMessaging } from '@/composables/useProjectionMessaging'
import { useAlert } from '@/composables/useAlert'
import { ViewType } from '@/types/common'
import AlertDialog from '@/components/Alert/AlertDialog.vue'

// i18n
const { t: $t } = useI18n()

// Electron composable
const { isElectron, onProjectionOpened, onProjectionClosed, checkProjectionWindow } = useElectron()

// 投影消息管理
const { setProjectionState, syncAllStates, sendTimerUpdate } = useProjectionMessaging()

// Alert 管理
const { alertState, warning, confirm, cancel } = useAlert()

// Props
const props = defineProps<{
  currentView: string
  drawerCollapsed: boolean
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
      return $t('timer.control')
    default:
      return 'HHC Project Client'
  }
})

// 是否顯示搜尋功能（計時器頁面時隱藏）
const showSearch = computed(() => {
  return props.currentView !== 'timer'
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
const projectionStore = useProjectionStore()

// 切換投影內容
const toggleProjectionContent = async () => {
  // 計算新的投影狀態
  const newShowDefault = !projectionStore.isShowingDefault

  // 如果是要開啟投影，根據主視窗當前頁面設置投影內容
  if (!newShowDefault) {
    // 開啟投影：根據主視窗當前頁面切換到對應的投影頁面
    // setProjectionState 會自動檢查並創建投影窗口
    await setProjectionState(false, props.currentView as ViewType)

    // 根據不同頁面發送對應的內容更新
    if (props.currentView === 'timer') {
      sendTimerUpdate(true)
    }
    // 聖經頁面會在 ProjectionView 請求當前狀態時自動更新
  } else {
    // 關閉投影：只切換狀態，不改變視圖
    await setProjectionState(true)
  }
}

// 關閉投影窗口
const closeProjectionWindow = async () => {
  if (isElectron()) {
    try {
      // 檢查投影窗口是否存在
      const projectionExists = await checkProjectionWindow()
      if (!projectionExists) {
        console.log('Projection window does not exist, nothing to close')
        return
      }

      // 使用 useAlert 的 warning 函數顯示確認對話框
      const confirmed = await warning(
        $t('projection.confirmClose'),
        $t('close') + $t('projection.title') + $t('window'),
      )

      if (confirmed) {
        // 用戶確認後才關閉
        await window.electronAPI.closeProjectionWindow()

        // 重置投影狀態為預設
        projectionStore.setShowingDefault(true)
      }
    } catch (error) {
      console.error('Error closing projection window:', error)
    }
  }
}

onMounted(() => {
  // 初始化時同步所有狀態到投影窗口（包含投影狀態、計時器狀態、主題等）
  syncAllStates()

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
