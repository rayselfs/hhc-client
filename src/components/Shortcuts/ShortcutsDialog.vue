<template>
  <v-dialog v-model="isOpen" max-width="800">
    <v-card>
      <v-card-title class="text-subtitle-1 d-flex align-center">
        {{ $t('shortcuts.title') }}
      </v-card-title>

      <v-card-text class="pa-6" style="max-height: 70vh; overflow-y: auto">
        <ShortcutSection
          :title="$t('shortcuts.projection')"
          :shortcuts="projectionShortcuts"
          class="mb-6"
        />
        <ShortcutSection :title="$t('shortcuts.timer')" :shortcuts="timerShortcuts" class="mb-6" />
        <ShortcutSection :title="$t('shortcuts.bible')" :shortcuts="bibleShortcuts" class="mb-6" />
        <ShortcutSection :title="$t('shortcuts.media')" :shortcuts="mediaShortcuts" class="mb-6" />
        <ShortcutSection :title="$t('shortcuts.edit')" :shortcuts="editShortcuts" />
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="isOpen = false">
          {{ $t('common.close') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useElectron } from '@/composables/useElectron'
import { KEYBOARD_SHORTCUTS } from '@/config/shortcuts'
import type { ShortcutConfig } from '@/composables/useKeyboardShortcuts'
import ShortcutSection from './ShortcutSection.vue'
import { isMac as checkIsMac } from '@/utils/platform'

const { t: $t } = useI18n()
const { isElectron, onMainMessage, removeAllListeners } = useElectron()

const isOpen = ref(false)
const isMac = checkIsMac()

const formatShortcut = (config: ShortcutConfig): string => {
  // Check platform specific overrides
  if (isMac && config.mac) return formatShortcut(config.mac)
  if (!isMac && config.windows) return formatShortcut(config.windows)

  const parts: string[] = []

  // Modifiers
  if (config.metaOrCtrl) parts.push(isMac ? 'Cmd' : 'Ctrl')
  if (config.ctrl) parts.push('Ctrl')
  if (config.meta) parts.push(isMac ? 'Cmd' : 'Win')
  if (config.shift) parts.push('Shift')
  if (config.alt) parts.push(isMac ? 'Opt' : 'Alt')

  // Keys
  if (config.keys && config.keys.length > 0) {
    const k = config.keys[0]
    if (k) parts.push(k)
  } else if (config.key) {
    if (config.key === ' ') parts.push('Space')
    else parts.push(config.key.toUpperCase())
  } else if (config.code) {
    parts.push(config.code.replace('Key', '').replace('Arrow', ''))
  }

  return parts.join('+')
}

interface DisplayShortcut {
  key: string
  description: string
}

const mapShortcuts = (section: Record<string, ShortcutConfig>): DisplayShortcut[] => {
  return Object.entries(section).map(([key, config]) => {
    // Simple helper to camelCase
    const camelKey = key.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase())

    return {
      key: formatShortcut(config),
      description: $t(`shortcuts.${camelKey}`),
    }
  })
}

const timerShortcuts = computed(() => mapShortcuts(KEYBOARD_SHORTCUTS.TIMER))
const projectionShortcuts = computed(() => mapShortcuts(KEYBOARD_SHORTCUTS.GLOBAL))
const bibleShortcuts = computed(() => mapShortcuts(KEYBOARD_SHORTCUTS.BIBLE))
const mediaShortcuts = computed(() => mapShortcuts(KEYBOARD_SHORTCUTS.MEDIA))
const editShortcuts = computed(() => mapShortcuts(KEYBOARD_SHORTCUTS.EDIT))

const openShortcuts = () => {
  isOpen.value = true
}

defineExpose({
  openShortcuts,
})

onMounted(() => {
  if (isElectron()) {
    onMainMessage((data: unknown) => {
      if (data === 'open-shortcuts') {
        openShortcuts()
      }
    })
  }
})

onBeforeUnmount(() => {
  if (isElectron()) {
    removeAllListeners('main-message')
  }
})
</script>

<style scoped></style>
