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
      rail-width="60"
      width="240"
    >
      <v-list class="pa-0">
        <v-list-item
          v-for="(item, index) in menuItems"
          :key="index"
          :value="index"
          @click="handleMenuItemClick(item)"
          :active="currentView === item.component"
          color="primary"
        >
          <template #prepend>
            <v-icon :icon="item.icon" size="24"></v-icon>
          </template>
          <v-list-item-title v-if="!drawerCollapsed" class="font-weight-medium">
            {{ $t(item.title) }}
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <v-slide-x-transition mode="out-in">
        <component :is="currentComponent" :key="currentView" />
      </v-slide-x-transition>
    </v-main>

    <GlobalOverlays />
  </v-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'

// Components
import ExtendedToolbar from '@/components/ExtendedToolbar.vue'
import GlobalOverlays from '@/components/GlobalOverlays.vue'

const BibleControl = defineAsyncComponent(() => import('@/layouts/control/BibleControl.vue'))
const TimerControl = defineAsyncComponent(() => import('@/layouts/control/TimerControl.vue'))
const MediaControl = defineAsyncComponent(() => import('@/layouts/control/MediaControl.vue'))

// Composables
import { useElectron } from '@/composables/useElectron'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useAlert } from '@/composables/useAlert'
import { useSentry } from '@/composables/useSentry'
import { useLocaleDetection } from '@/composables/useLocaleDetection'
import { useProjectionManager } from '@/composables/useProjectionManager'

// Stores
import { useFileCleanup } from '@/composables/useFileCleanup'
import { useProjectionStore } from '@/stores/projection'

// Types
import { MessageType, ViewType, type AppMessage, type MenuItem } from '@/types/common'

const { t: $t } = useI18n()
const { reportError } = useSentry()
const { warning } = useAlert()
const { initializeLanguage } = useLocaleDetection()

const { setProjectionState, syncAllStates } = useProjectionManager()
const projectionStore = useProjectionStore()
const { runCleanup } = useFileCleanup()

const { currentView } = storeToRefs(projectionStore)

const {
  isElectron,
  onMainMessage,
  onNoSecondScreenDetected,
  checkProjectionWindow,
  ensureProjectionWindow,
  removeAllListeners,
} = useElectron()

// Toggle projection state
const toggleProjection = async () => {
  // If in Media view, let MediaControl handle the shortcut (START_PRESENTATION)
  if (currentView.value === ViewType.MEDIA) return

  const newShowDefault = !projectionStore.isShowingDefault
  await setProjectionState(newShowDefault)
}

// Close projection
const closeProjection = async () => {
  if (!projectionStore.isShowingDefault) {
    await setProjectionState(true)
  }
}

const drawer = ref(true)
const drawerCollapsed = ref(true)

import { KEYBOARD_SHORTCUTS } from '@/config/shortcuts'

useKeyboardShortcuts([
  {
    config: KEYBOARD_SHORTCUTS.GLOBAL.TOGGLE_PROJECTION,
    handler: toggleProjection,
  },
  {
    config: KEYBOARD_SHORTCUTS.GLOBAL.CLOSE_PROJECTION,
    handler: closeProjection,
  },
])

const menuItems = ref<MenuItem[]>([
  {
    title: 'timer.title',
    icon: 'mdi-clock-outline',
    component: ViewType.TIMER,
  },
  {
    title: 'bible.title',
    icon: 'mdi-book-open-variant',
    component: ViewType.BIBLE,
  },
  {
    title: 'media.title',
    icon: 'mdi-folder-multiple-image',
    component: ViewType.MEDIA,
  },
])

const componentMap = {
  [ViewType.BIBLE]: BibleControl,
  [ViewType.TIMER]: TimerControl,
  [ViewType.MEDIA]: MediaControl,
}

const currentComponent = computed(() => {
  return componentMap[currentView.value as keyof typeof componentMap]
})

const toggleDrawer = () => {
  drawerCollapsed.value = !drawerCollapsed.value
}

const handleMenuItemClick = (item: MenuItem) => {
  projectionStore.setCurrentView(item.component)
}
const handleElectronMessage = (data: AppMessage) => {
  if (data.type === MessageType.SYSTEM_GET_STATE) {
    syncAllStates()
  }
}

const handleNoSecondScreen = async () => {
  await warning($t('alert.dualScreenRequired'), $t('alert.screenWarning'), {
    showDontShowAgain: true,
    alertId: 'no-second-screen-warning',
  })
}

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

// Lifecycle hooks
onMounted(async () => {
  await initializeLanguage()
  if (isElectron()) {
    onNoSecondScreenDetected(handleNoSecondScreen)
    await checkAndEnsureProjectionWindow()
    onMainMessage(handleElectronMessage)
  }

  runCleanup()
})

onBeforeUnmount(() => {
  if (isElectron()) {
    removeAllListeners('main-message')
    removeAllListeners('no-second-screen-detected')
  }
})
</script>

<style scoped>
:deep(.v-list-item--active) {
  /* Override: Force active nav item color to match theme primary */
  background-color: rgb(var(--v-theme-primary)) !important;
  /* Override: Ensure text color contrasts on active nav item */
  color: rgb(var(--v-theme-on-primary)) !important;
  /* Override: Ensure opacity remains fully visible when active */
  opacity: 1 !important;
}

:deep(.v-list-item--active .v-list-item__overlay) {
  /* Override: Hide default overlay for active list item */
  display: none !important;
}

:deep(.v-list-item--active .v-icon) {
  /* Override: Ensure active icon inherits the active text color */
  color: inherit !important;
}
</style>
