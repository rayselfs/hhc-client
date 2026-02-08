<template>
  <v-card :style="{ height: props.height ? `${props.height}px` : '100%' }" rounded="lg">
    <v-card-text>
      <!-- Chapter/Verse Navigation -->
      <v-row>
        <v-col cols="6">
          <v-label class="text-subtitle-1">{{ $t('bible.controlChapter') }}</v-label>
        </v-col>
        <v-col cols="6">
          <v-label class="text-subtitle-1">{{ $t('bible.controlVerse') }}</v-label>
        </v-col>
        <v-col cols="6" align="center" class="pa-1">
          <div>
            <liquid-btn
              icon="mdi-chevron-left"
              size="x-large"
              class="mr-3"
              :disabled="!currentPassage || currentPassage.chapter <= 1"
              @click="goToPreviousChapterProjection"
            />
            <liquid-btn
              icon="mdi-chevron-right"
              size="x-large"
              :disabled="!currentPassage || currentPassage.chapter >= maxChapters"
              @click="goToNextChapterProjection"
            />
          </div>
        </v-col>
        <v-col cols="6" align="center" class="pa-1">
          <div>
            <liquid-btn
              icon="mdi-chevron-up"
              size="x-large"
              class="mr-3"
              :disabled="!currentPassage || currentPassage.verse <= 1"
              @click="goToPreviousVerseProjection"
            />
            <liquid-btn
              icon="mdi-chevron-down"
              size="x-large"
              :disabled="!hasCurrentPassage || (currentPassage?.verse ?? 0) >= maxVerse"
              @click="goToNextVerseProjection"
            />
          </div>
        </v-col>
      </v-row>
      <!-- Font Size Slider -->
      <v-row>
        <v-col cols="12">
          <v-label class="text-subtitle-1 mb-2">{{ $t('bible.controlFontSize') }}</v-label>
          <v-slider
            v-model="fontSize"
            :min="BIBLE_CONFIG.FONT.MIN_SIZE"
            :max="BIBLE_CONFIG.FONT.MAX_SIZE"
            :step="BIBLE_CONFIG.FONT.SIZE_STEP"
            thumb-label
            @update:model-value="handleFontSizeUpdate"
          >
            <template #thumb-label="{ modelValue }"> {{ modelValue }}px </template>
          </v-slider>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useBibleStore } from '@/stores/bible'
import { useBible } from '@/composables/useBible'
import { BIBLE_CONFIG } from '@/config/app'
import { StorageKey, StorageCategory, getStorageKey } from '@/types/common'
import { useLocalStorage } from '@/composables/useLocalStorage'

interface Props {
  height?: number
}

const props = defineProps<Props>()

const { t: $t } = useI18n()
const { getLocalItem, setLocalItem } = useLocalStorage()
const bibleStore = useBibleStore()
const { currentPassage, previewBook, previewVerses } = storeToRefs(bibleStore)

const {
  maxChapters,
  goToPreviousChapter,
  goToNextChapter,
  goToPreviousVerse,
  goToNextVerse,
  updateProjection,
  updateProjectionFontSize,
} = useBible(currentPassage, previewBook, previewVerses)

// Font size control
const getInitialFontSize = () => {
  const savedFontSize = getLocalItem<number>(
    getStorageKey(StorageCategory.BIBLE, StorageKey.FONT_SIZE),
  )
  return savedFontSize ? savedFontSize : BIBLE_CONFIG.FONT.DEFAULT_SIZE
}
const fontSize = ref(getInitialFontSize())

const maxVerse = computed(() => previewVerses.value.length)
const hasCurrentPassage = computed(() => !!currentPassage.value)

const goToPreviousChapterProjection = () => {
  goToPreviousChapter(true, updateProjection)
}

const goToNextChapterProjection = () => {
  goToNextChapter(true, updateProjection)
}

const goToPreviousVerseProjection = () => {
  goToPreviousVerse(true, updateProjection)
}

const goToNextVerseProjection = () => {
  goToNextVerse(true, updateProjection)
}

const handleFontSizeUpdate = () => {
  setLocalItem(getStorageKey(StorageCategory.BIBLE, StorageKey.FONT_SIZE), fontSize.value)
  updateProjectionFontSize(fontSize.value)
}

onMounted(() => {
  updateProjectionFontSize(fontSize.value)
})

defineExpose({
  goToPreviousVerseProjection,
  goToNextVerseProjection,
})
</script>
