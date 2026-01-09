<template>
  <div class="history-content" style="height: 100%">
    <div v-if="historyVerses.length === 0" class="text-center pa-4 text-grey">
      {{ $t('bible.noHistory') }}
    </div>
    <v-virtual-scroll
      v-else
      :items="historyVerses"
      :height="containerHeight ? `${containerHeight - 48}px` : 'calc(100% - 48px)'"
      :item-height="80"
    >
      <template #default="{ item }">
        <div
          class="verse-item pa-3 d-flex align-center justify-space-between"
          @click="handleLoadVerse(item)"
          @contextmenu="handleRightClick($event, item)"
        >
          <div>
            <div class="text-h6 font-weight-medium d-flex">
              <span class="mr-1 text-no-wrap"
                >{{ item.bookAbbreviation }}{{ item.chapter }}:{{ item.verse }} -
              </span>
              <span class="text-justify">{{ item.verseText }}</span>
            </div>
          </div>
          <v-btn
            class="verse-btn"
            icon
            size="small"
            variant="text"
            @click.stop="handleRemoveItem(item.id)"
          >
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </div>
      </template>
    </v-virtual-scroll>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { VerseItem } from '@/types/common'

interface Props {
  historyVerses: VerseItem[]
  containerHeight?: number
}

interface Emits {
  (e: 'load-verse', item: VerseItem): void
  (e: 'remove-item', id: string): void
  (e: 'right-click', event: MouseEvent, item: VerseItem): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
const { t: $t } = useI18n()

const handleLoadVerse = (item: VerseItem) => {
  emit('load-verse', item)
}

const handleRemoveItem = (id: string) => {
  emit('remove-item', id)
}

const handleRightClick = (event: MouseEvent, item: VerseItem) => {
  emit('right-click', event, item)
}
</script>

<style scoped>
.verse-item {
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-radius: 4px;
  user-select: none;
}

.verse-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.4);
}

.verse-btn {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.verse-item:hover .verse-btn {
  opacity: 1;
}
</style>
