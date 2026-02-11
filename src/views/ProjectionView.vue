<template>
  <v-app>
    <v-main class="fill-height h-100 w-100">
      <v-container fluid class="fill-height pa-0 bg-black text-white">
        <component :is="currentComponent" :key="componentKey" />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import DefaultProjection from '@/layouts/projection/DefaultProjection.vue'
import BibleProjection from '@/layouts/projection/BibleProjection.vue'
import TimerProjection from '@/layouts/projection/TimerProjection.vue'
import MediaProjection from '@/layouts/projection/MediaProjection.vue'
import { useProjectionStore } from '@/stores/projection'
import { useProjectionElectron } from '@/composables/useElectron'
import { ViewType, type AppMessage } from '@/types/projection'
import { useLocaleDetection } from '@/composables/useLocaleDetection'
// 引入 Dispatcher
import { useProjectionManager } from '@/composables/useProjectionManager'

const projectionStore = useProjectionStore()

const { dispatchMessage } = useProjectionManager()

const handleMessage = (data: AppMessage) => {
  dispatchMessage(data)
}

const {
  isElectron,
  handleMessage: setupMessageHandler,
  requestCurrentState,
  removeAllListeners,
} = useProjectionElectron()

const { initializeLanguage } = useLocaleDetection()

const currentComponent = computed(() => {
  if (projectionStore.isShowingDefault) {
    return DefaultProjection
  }

  switch (projectionStore.currentView) {
    case ViewType.BIBLE:
      return BibleProjection
    case ViewType.TIMER:
      return TimerProjection
    case ViewType.MEDIA:
      return MediaProjection
    default:
      return DefaultProjection
  }
})

const componentKey = computed(() => {
  if (projectionStore.isShowingDefault) {
    return ViewType.DEFAULT
  }
  return projectionStore.currentView || 'fallback'
})

onMounted(() => {
  setupMessageHandler(handleMessage)
  requestCurrentState()
  initializeLanguage()
  document.documentElement.style.overflow = 'hidden'
})

onBeforeUnmount(() => {
  if (isElectron()) {
    removeAllListeners('projection-message')
  }
  document.documentElement.style.overflow = ''
})
</script>

<style scoped></style>
