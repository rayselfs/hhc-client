<template>
  <div class="d-flex align-center justify-end mr-3" :class="{ 'w-100': isSearching }">
    <template v-if="isSearching">
      <v-text-field
        v-model="searchText"
        autofocus
        hide-details
        :placeholder="$t('common.search')"
        variant="solo-filled"
        density="compact"
        class="search-input"
        prepend-inner-icon="mdi-magnify"
        @keydown.esc="handleClose"
        @keydown.enter="handleInput"
      >
      </v-text-field>

      <v-btn variant="tonal" @click="handleClose" class="close-btn" elevation="0">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </template>

    <v-btn v-else icon @click="handleStart" :title="$t('common.search')" :disabled="isIndexing">
      <v-icon>mdi-magnify</v-icon>
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBibleStore } from '@/stores/bible'

defineOptions({
  name: 'SearchBar',
})

const { t: $t } = useI18n()
const bibleStore = useBibleStore()

const isSearching = ref(false)
const searchText = ref('')

// Disable search can be triggered by either local searching state or store indexing state
const isIndexing = computed(() => bibleStore.isIndexing)

const handleStart = () => {
  isSearching.value = true
}

const handleClose = () => {
  isSearching.value = false
  searchText.value = ''
}

const handleInput = (event: KeyboardEvent) => {
  if (event.isComposing) return

  if (searchText.value.trim()) {
    console.log('[SearchBar] Dispatching search event:', searchText.value.trim())
    window.dispatchEvent(
      new CustomEvent('bible-search', {
        detail: { text: searchText.value.trim() },
      }),
    )
  }
  handleClose()
}
</script>

<style scoped>
.search-input {
  z-index: 1000;
  flex-grow: 1;
}

.search-input :deep(.v-field) {
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
  border-top-left-radius: 24px !important;
  border-bottom-left-radius: 24px !important;
}

.close-btn {
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
  border-top-right-radius: 24px !important;
  border-bottom-right-radius: 24px !important;
  margin-left: 0 !important;
  min-width: 40px;
  height: 40px;
}
</style>
