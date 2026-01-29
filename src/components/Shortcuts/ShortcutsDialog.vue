<template>
  <v-dialog v-model="isOpen" max-width="800" @keydown.esc="isOpen = false">
    <v-card rounded="rounded-lg" :elevation="3">
      <v-card-title class="text-h6 d-flex align-center">
        {{ $t('shortcuts.title') }}
      </v-card-title>

      <v-card-text>
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
        <v-spacer />
        <liquid-btn @click="isOpen = false">
          {{ $t('common.close') }}
        </liquid-btn>
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

const formatCode = (code: string): string => {
  return code.replace('Key', '').replace('Arrow', '').replace('Numpad', '').replace('Page', 'Pg')
}

const formatShortcut = (config: ShortcutConfig): string => {
  // Check platform specific overrides
  if (isMac && config.mac) return formatShortcut(config.mac)
  if (!isMac && config.windows) return formatShortcut(config.windows)

  const modifiers: string[] = []

  // Modifiers
  if (config.metaOrCtrl) modifiers.push(isMac ? 'Cmd' : 'Ctrl')
  if (config.ctrl) modifiers.push('Ctrl')
  if (config.meta) modifiers.push(isMac ? 'Cmd' : 'Win')
  if (config.shift) modifiers.push('Shift')
  if (config.alt) modifiers.push(isMac ? 'Opt' : 'Alt')

  const modifierPrefix = modifiers.length > 0 ? modifiers.join('+') + '+' : ''

  // Handle multiple codes - show up to 3
  if (config.codes && config.codes.length > 0) {
    const displayCodes = config.codes.slice(0, 3).map(formatCode)
    return displayCodes.map((c) => modifierPrefix + c).join(' / ')
  }

  // Handle multiple keys - show up to 3
  if (config.keys && config.keys.length > 0) {
    const displayKeys = config.keys.slice(0, 3)
    return displayKeys.map((k) => modifierPrefix + k).join(' / ')
  }

  // Single key
  if (config.key) {
    const keyDisplay = config.key === ' ' ? 'Space' : config.key.toUpperCase()
    return modifierPrefix + keyDisplay
  }

  // Single code
  if (config.code) {
    return modifierPrefix + formatCode(config.code)
  }

  return ''
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
