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
      :title="projectionStore.isShowingDefault ? $t('open') : $t('close')"
      variant="outlined"
    >
      <v-icon v-if="projectionStore.isShowingDefault" class="mr-2">mdi-monitor</v-icon>
      <v-icon v-else class="mr-2">mdi-monitor-off</v-icon>
      {{ $t('projection') }}
    </v-btn>

    <v-btn
      class="mr-4"
      @click="closeProjectionWindow"
      color="error"
      :title="$t('close') + $t('projection') + $t('window')"
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
import AlertDialog from '@/components/Alert/AlertDialog.vue'

// i18n
const { t: $t } = useI18n()

// Electron composable
const {
  isElectron,
  onProjectionOpened,
  onProjectionClosed,
  checkProjectionWindow,
  ensureProjectionWindow,
} = useElectron()

// 投影消息管理
const { sendProjectionToggle, sendTimerUpdate } = useProjectionMessaging()

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
      return $t('timer')
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

// 投影功能
const projectionStore = useProjectionStore()

// 切換投影內容
const toggleProjectionContent = async () => {
  let windowWasCreated = false

  if (isElectron()) {
    try {
      const projectionExists = await checkProjectionWindow()
      if (!projectionExists) {
        await ensureProjectionWindow()
        windowWasCreated = true
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    } catch (error) {
      console.error('Error checking/creating projection window:', error)
    }
  }

  projectionStore.toggleProjectionContent()
  if (windowWasCreated) {
    sendProjectionToggle()
    sendTimerUpdate(true)
  } else {
    sendProjectionToggle()
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
        $t('confirmCloseProjection'),
        $t('close') + $t('projection') + $t('window'),
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
  // 初始化時發送當前狀態
  sendProjectionToggle()

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
