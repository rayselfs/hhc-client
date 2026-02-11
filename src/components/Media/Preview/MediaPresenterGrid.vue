<template>
  <v-container fluid class="media-presenter-grid overflow-y-auto">
    <v-row>
      <v-col v-for="(item, index) in playlist" :key="item.id" cols="6" sm="4" md="3" lg="2">
        <v-card
          @click="$emit('jump', index)"
          hover
          :color="index === currentIndex ? 'primary' : 'grey-darken-4'"
        >
          <MediaThumbnail
            :item="item"
            aspect-ratio="1.77"
            :fallback-icon="getIcon(item.metadata.fileType)"
            :cover="true"
          >
            <div
              v-if="item.metadata.fileType !== 'image'"
              class="d-flex align-center justify-center fill-height"
              style="position: absolute; top: 0; left: 0; width: 100%; height: 100%"
            >
              <v-icon size="36" color="white" style="text-shadow: 0 0 5px black">{{
                getIcon(item.metadata.fileType)
              }}</v-icon>
            </div>
          </MediaThumbnail>
          <v-card-text class="text-caption text-truncate"
            >{{ index + 1 }}. {{ item.name }}</v-card-text
          >
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import type { FileItem } from '@/types/folder'
import MediaThumbnail from '@/components/Media/MediaThumbnail.vue'

interface Props {
  playlist: FileItem[]
  currentIndex: number
}

defineProps<Props>()
defineEmits<{
  (e: 'jump', index: number): void
}>()

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
