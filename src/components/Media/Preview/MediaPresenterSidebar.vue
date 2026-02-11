<template>
  <v-col cols="4" class="media-presenter-sidebar d-flex flex-column pa-4">
    <!-- Next Slide -->
    <div class="d-flex flex-column border-b">
      <div class="text-subtitle-1 mb-2 text-grey">{{ $t('media.nextSlide') }}</div>
      <div
        class="next-preview bg-black rounded mb-4 d-flex align-center justify-center"
        style="aspect-ratio: 16/9; width: 100%; height: auto"
      >
        <MediaThumbnail
          v-if="nextItem"
          :item="nextItem"
          :fallback-icon="getIcon(nextItem.metadata.fileType)"
          class="preview-content rounded"
          style="width: 100%; height: 100%"
        >
          <template #placeholder>
            <div class="text-center">
              <v-icon size="48" color="grey">
                {{ getIcon(nextItem.metadata.fileType) }}
              </v-icon>
              <div class="text-caption mt-1">{{ nextItem.name }}</div>
            </div>
          </template>
        </MediaThumbnail>
        <div v-else class="text-grey text-caption">{{ $t('media.endOfSlides') }}</div>
      </div>
    </div>

    <!-- Notes -->
    <div class="flex-grow-1 d-flex flex-column">
      <v-textarea
        v-model="itemNotes"
        variant="plain"
        hide-details
        class="fill-height"
        no-resize
        :placeholder="$t('media.ClickToAddNotes')"
        @change="updateNotes"
      ></v-textarea>
    </div>
  </v-col>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { FileItem } from '@/types/folder'
import MediaThumbnail from '@/components/Media/MediaThumbnail.vue'

interface Props {
  nextItem: FileItem | null | undefined
  currentItem: FileItem | null | undefined
}

const props = defineProps<Props>()
interface Emits {
  (e: 'update:notes', notes: string): void
}
const emit = defineEmits<Emits>()

const itemNotes = ref('')

watch(
  () => props.currentItem,
  (newItem) => {
    if (newItem) {
      itemNotes.value = newItem.notes || ''
    }
  },
  { immediate: true },
)

const updateNotes = () => {
  // Emit note changes to parent to avoid mutating props directly
  emit('update:notes', itemNotes.value)
}

const getIcon = (type: string) => {
  switch (type) {
    case 'video':
      return 'mdi-video'
    case 'pdf':
      return 'mdi-file-pdf-box'
    case 'audio':
      return 'mdi-music'
    default:
      return 'mdi-file'
  }
}
</script>
