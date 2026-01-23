<template>
  <div class="bible-version-selector-wrapper">
    <!-- version selector -->
    <v-select
      v-model="selectedVersionCode"
      :items="bibleVersions"
      item-title="name"
      item-value="code"
      :loading="versionsLoading || contentLoading"
      density="compact"
      variant="solo-filled"
      hide-details
      class="bible-version-selector mr-2"
      rounded="xl"
      :menu-props="{ contentClass: 'rounded-xl' }"
      :disabled="versionsLoading || contentLoading"
    >
      <template v-slot:item="{ props }">
        <v-list-item v-bind="props" class="version-item"> </v-list-item>
      </template>
    </v-select>

    <!-- dropdown button -->
    <liquid-btn
      :disabled="!selectedVersionCode"
      @click="showBooksDialog = true"
      :title="$t('bible.selectBooks')"
      icon="mdi-book-open-page-variant"
      :class="{ 'mr-2': isMultiVersion }"
    />

    <!-- Second version selector -->
    <v-select
      v-if="isMultiVersion"
      v-model="secondVersionCode"
      :items="bibleVersions"
      item-title="name"
      item-value="code"
      :loading="versionsLoading || contentLoading"
      density="compact"
      variant="solo-filled"
      hide-details
      class="bible-version-selector"
      rounded="xl"
      :disabled="versionsLoading || contentLoading"
      :menu-props="{ contentClass: 'rounded-xl' }"
      :placeholder="$t('bible.selectSecondVersion')"
    >
      <template v-slot:item="{ props }">
        <v-list-item v-bind="props" class="version-item"> </v-list-item>
      </template>
    </v-select>

    <!-- Multi-version toggle -->
    <v-btn
      variant="text"
      density="compact"
      icon
      :color="isMultiVersion ? 'primary' : undefined"
      @click="toggleMultiVersion"
      :title="$t('bible.multiVersion')"
      :class="!isMultiVersion ? 'ml-5' : 'ml-2'"
    >
      <v-icon>mdi-view-split-horizontal</v-icon>
    </v-btn>

    <!-- Books Dialog -->
    <BooksDialog
      v-model="showBooksDialog"
      :version-code="selectedVersionCode"
      @select-verse="handleSelectVerseFromDialog"
    />
  </div>
</template>

<script setup lang="ts">
defineOptions({
  name: 'BibleVersionSelector',
})

import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useSentry } from '@/composables/useSentry'
import { useBibleStore } from '@/stores/bible'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { KEYBOARD_SHORTCUTS } from '@/config/shortcuts'
import { BooksDialog } from '@/components/Bible'

const { reportError } = useSentry()
const { t: $t } = useI18n()

// Bible store handling versions, current selection, and cached content
const bibleStore = useBibleStore()
const { versions, versionsLoading, currentVersion, isMultiVersion, secondVersionCode } =
  storeToRefs(bibleStore)
const { setCurrentVersionByCode, getBibleContent } = bibleStore

const contentLoading = ref(false)

const bibleVersions = computed(() => versions.value)

const selectedVersionCode = computed<string | null>({
  get: () => currentVersion.value?.code ?? null,
  set: (value) => {
    setCurrentVersionByCode(value)
  },
})

/**
 * Load Bible content (prefer cached version)
 * @param versionCode - Version code
 */
const loadBibleContentForVersion = async (versionCode: string) => {
  contentLoading.value = true

  try {
    await getBibleContent(versionCode)
  } catch (error) {
    reportError(error, {
      operation: 'load-bible-content',
      component: 'BibleVersionSelector',
      extra: { versionCode },
    })
  } finally {
    contentLoading.value = false
  }
}

// Watch for version changes and preload content for later use
// Note: This is a proactive cache preload. The actual content loading is handled
// by BibleControl when needed. Due to getBibleContent's deduplication mechanism,
// duplicate calls won't cause actual duplicate requests.
watch(
  () => currentVersion.value?.code,
  async (newVersionCode, oldVersionCode) => {
    // Only preload when version actually changes (not on initial mount)
    if (newVersionCode && newVersionCode !== oldVersionCode) {
      await loadBibleContentForVersion(newVersionCode)
    }
  },
)

watch(
  () => secondVersionCode.value,
  async (newVersionCode, oldVersionCode) => {
    // Only preload when version actually changes (not on initial mount)
    if (newVersionCode && newVersionCode !== oldVersionCode) {
      await loadBibleContentForVersion(newVersionCode)
    }
  },
)

// Expose selectedVersion for external use
defineExpose({
  selectedVersion: computed(() => selectedVersionCode.value),
})

const toggleMultiVersion = () => {
  isMultiVersion.value = !isMultiVersion.value
}

// Books dialog state
const showBooksDialog = ref(false)

// Handle verse selection from dialog
const handleSelectVerseFromDialog = (bookNumber: number, chapter: number, verse: number) => {
  // Dispatch event to BibleControl for verse selection handling
  window.dispatchEvent(
    new CustomEvent('bible-select-verse', {
      detail: { bookNumber, chapter, verse },
    }),
  )
}

// Keyboard shortcuts for books dialog
useKeyboardShortcuts([
  {
    config: KEYBOARD_SHORTCUTS.BIBLE.TOGGLE_BOOK_DIALOG, // G key
    handler: () => {
      showBooksDialog.value = !showBooksDialog.value
    },
  },
  {
    config: KEYBOARD_SHORTCUTS.BIBLE.CLOSE_DIALOG, // ESC key
    handler: () => {
      if (showBooksDialog.value) {
        showBooksDialog.value = false
      }
    },
    preventDefault: false, // Allow other ESC handlers if dialog is closed
  },
])
</script>

<style scoped>
.bible-version-selector-wrapper {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 4px;
}

.bible-version-selector {
  min-width: 220px;
  max-width: 300px;
}

.bible-version-selector > .v-input__control > .v-field {
  height: 36px;
}

.version-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.version-item :deep(.v-list-item__append) {
  padding-inline-start: 8px;
}
</style>
