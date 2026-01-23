<template>
  <v-app-bar dark prominent>
    <v-app-bar-nav-icon @click="emitToggleDrawer">
      <v-icon>{{ drawerCollapsed ? 'mdi-menu' : 'mdi-menu-open' }}</v-icon>
    </v-app-bar-nav-icon>
    <v-app-bar-title class="text-h5">{{ toolbarTitle }}</v-app-bar-title>
    <v-spacer />

    <v-slide-x-transition mode="out-in">
      <BibleVersionSelector v-if="props.currentView === 'bible'" />
    </v-slide-x-transition>

    <v-spacer />

    <v-slide-x-transition mode="out-in">
      <LiquidSearchBar
        v-if="props.currentView !== 'timer'"
        class="mr-2"
        :placeholder="$t('common.search')"
        :disabled="isIndexing"
        expanded-width="300"
        @search="handleSearch"
      />
    </v-slide-x-transition>

    <liquid-btn
      class="mr-2"
      @click="toggleProjectionContent"
      :variant="!projectionStore.isShowingDefault ? 'tinted' : 'glass'"
      :color="!projectionStore.isShowingDefault ? 'error' : undefined"
      :title="
        projectionStore.isShowingDefault
          ? $t('extendedToolbar.openProjection')
          : $t('extendedToolbar.closeProjection')
      "
      :disabled="props.currentView === 'media'"
      :icon="projectionStore.isShowingDefault ? 'mdi-monitor' : 'mdi-monitor-off'"
    />

    <liquid-btn
      class="mr-4"
      @click="closeProjectionWindow"
      color="error"
      variant="text"
      :title="$t('extendedToolbar.closeProjectionWindow')"
      icon="mdi-close"
      :disabled="!projectionWindowExists"
    />
  </v-app-bar>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectionStore } from '@/stores/projection'
import { useBibleStore } from '@/stores/bible'
import { useElectron } from '@/composables/useElectron'
import { useAlert } from '@/composables/useAlert'
import { ViewType } from '@/types/common'
import { VersionSelector as BibleVersionSelector } from '@/components/Bible'
import { useProjectionManager } from '@/composables/useProjectionManager'
import { useSentry } from '@/composables/useSentry'

const { reportError } = useSentry()
const { t: $t } = useI18n()
const bibleStore = useBibleStore()
const isIndexing = computed(() => bibleStore.isIndexing)
const {
  isElectron,
  onProjectionOpened,
  onProjectionClosed,
  checkProjectionWindow,
  closeProjectionWindow: closeElectronProjectionWindow,
} = useElectron()
const { setProjectionState, syncAllStates } = useProjectionManager()
const { warning } = useAlert()

// 追蹤投影窗口是否存在
const projectionWindowExists = ref(false)

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
      return $t('bible.title')
    case 'timer':
      return $t('timer.title')
    case 'media':
      return $t('media.title')
    default:
      return 'HHC Project Client'
  }
})

const emitToggleDrawer = () => {
  emit('toggle-drawer')
}

const handleSearch = (text: string) => {
  window.dispatchEvent(
    new CustomEvent('bible-search', {
      detail: { text },
    }),
  )
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
      syncAllStates()
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
        $t('extendedToolbar.confirmClose'),
        $t('extendedToolbar.closeProjectionWindow'),
      )

      if (confirmed) {
        // 用戶確認後才關閉
        await closeElectronProjectionWindow()

        // 重置投影狀態為預設
        projectionStore.setShowingDefault(true)
      }
    } catch (error) {
      reportError(error, {
        operation: 'close-projection-window',
        component: 'ExtendedToolbar',
      })
    }
  }
}

onMounted(async () => {
  // 初始化時同步所有狀態到投影窗口（包含投影狀態、計時器狀態、主題等）
  syncAllStates()

  // 監聽投影窗口狀態變化
  if (isElectron()) {
    // 初始化時檢查投影窗口是否存在
    projectionWindowExists.value = await checkProjectionWindow()

    onProjectionOpened(() => {
      // 投影窗口開啟時，預設顯示預設內容（投影關閉狀態）
      projectionStore.setShowingDefault(true)
      projectionWindowExists.value = true
    })

    onProjectionClosed(() => {
      // 投影窗口關閉時，重置為預設內容狀態
      projectionStore.setShowingDefault(true)
      projectionWindowExists.value = false
    })
  }
})
</script>
