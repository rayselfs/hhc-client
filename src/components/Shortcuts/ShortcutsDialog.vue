<template>
  <v-dialog v-model="isOpen" max-width="800">
    <v-card>
      <v-card-title class="text-subtitle-1 d-flex align-center">
        {{ $t('shortcuts.title') }}
      </v-card-title>

      <v-card-text class="pa-6">
        <ShortcutSection :title="$t('shortcuts.timer')" :shortcuts="timerShortcuts" class="mb-6" />
        <ShortcutSection :title="$t('shortcuts.projection')" :shortcuts="projectionShortcuts" />
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="isOpen = false">
          {{ $t('close') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useElectron } from '@/composables/useElectron'
import { TIMER_SHORTCUTS, PROJECTION_SHORTCUTS } from './shortcuts'
import ShortcutSection from './ShortcutSection.vue'

const { t: $t } = useI18n()
const { isElectron } = useElectron()

const isOpen = ref(false)

// 計時器快捷鍵 (實際實現的快捷鍵)
const timerShortcuts = computed(() =>
  TIMER_SHORTCUTS.map((shortcut) => ({
    ...shortcut,
    description: $t(shortcut.description),
  })),
)

// 投影快捷鍵 (實際實現的快捷鍵)
const projectionShortcuts = computed(() =>
  PROJECTION_SHORTCUTS.map((shortcut) => ({
    ...shortcut,
    description: $t(shortcut.description),
  })),
)

const openShortcuts = () => {
  isOpen.value = true
}

defineExpose({
  openShortcuts,
})

onMounted(() => {
  if (isElectron()) {
    window.electronAPI.onMainMessage((data: unknown) => {
      if (data === 'open-shortcuts') {
        openShortcuts()
      }
    })
  }
})

onBeforeUnmount(() => {
  if (isElectron()) {
    window.electronAPI.removeAllListeners('main-message')
  }
})
</script>

<style scoped>
/* 樣式已移至 ShortcutSection.vue */
</style>
