<template>
  <div class="d-flex align-center justify-space-between w-100">
    <div class="d-flex align-center ga-2">
      <span class="mr-1">{{ $t('common.preview') }}</span>
      <div v-if="currentPassage && !props.isSearchMode">
        <span class="mr-1"
          >({{ localizedBookName }} {{ currentPassage.chapter }}:{{ currentPassage.verse }})</span
        >
      </div>
      <div v-if="props.isSearchMode">
        <span>({{ $t('common.search') }})</span>
      </div>
    </div>
    <div v-if="currentPassage" class="d-flex align-center ga-2">
      <v-btn
        size="small"
        class="mr-1"
        :disabled="props.isSearchMode || currentPassage.chapter <= 1"
        rounded="xl"
        @click="goToPreviousChapterPreview"
      >
        <v-icon>mdi-chevron-left</v-icon>
      </v-btn>
      <v-btn
        size="small"
        :disabled="props.isSearchMode || currentPassage.chapter >= maxChapters"
        rounded="xl"
        @click="goToNextChapterPreview"
      >
        <v-icon>mdi-chevron-right</v-icon>
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useBibleStore } from '@/stores/bible'
import { useBible } from '@/composables/useBible'
import { BIBLE_BOOKS } from '@/config/app'

interface Props {
  isSearchMode: boolean
}

const props = defineProps<Props>()

const { t: $t } = useI18n()
const bibleStore = useBibleStore()
const { currentPassage, previewBook, previewVerses } = storeToRefs(bibleStore)

const { maxChapters, goToPreviousChapter, goToNextChapter } = useBible(
  currentPassage,
  previewBook,
  previewVerses,
)

const localizedBookName = computed(() => {
  const passage = currentPassage.value
  if (!passage) return ''

  const bookConfig = BIBLE_BOOKS.find((b) => b.number === passage.bookNumber)
  if (bookConfig) {
    return $t(`bible.books.${bookConfig.code}`)
  }
  return ''
})

const goToPreviousChapterPreview = () => {
  goToPreviousChapter(false)
}

const goToNextChapterPreview = () => {
  goToNextChapter(false)
}
</script>
