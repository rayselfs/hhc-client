<template>
  <div class="d-flex align-center justify-end" :class="{ 'w-100': isSearching }">
    <v-text-field
      v-if="isSearching"
      v-model="searchText"
      autofocus
      variant="solo-inverted"
      hide-details
      :placeholder="$t('common.search')"
      density="compact"
      class="search-bar mr-2"
      @keydown.esc="handleClose"
      @keydown.enter="handleInput"
    >
    </v-text-field>

    <v-btn
      v-if="!isSearching"
      icon
      @click="handleStart"
      :title="$t('common.search')"
      :disabled="isIndexing"
      class="mr-1"
    >
      <v-icon>mdi-magnify</v-icon>
    </v-btn>

    <v-btn v-if="isSearching" icon @click="handleClose" class="mr-1">
      <v-icon>mdi-close</v-icon>
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
.search-bar {
  z-index: 1000;
  width: 100%;
}
</style>
