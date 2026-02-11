<template>
  <v-img
    v-if="thumbnailSrc"
    :src="thumbnailSrc"
    :cover="cover"
    :aspect-ratio="aspectRatio"
    class=""
  >
    <slot></slot>
    <template #error>
      <div class="d-flex align-center justify-center fill-height">
        <v-icon size="36" color="grey">mdi-image-off</v-icon>
      </div>
    </template>
    <template #placeholder>
      <div class="d-flex align-center justify-center fill-height">
        <v-progress-circular indeterminate color="grey" size="20"></v-progress-circular>
      </div>
    </template>
  </v-img>
  <div v-else class="d-flex align-center justify-center" :style="{ aspectRatio: aspectRatio }">
    <slot name="placeholder">
      <v-icon size="48" color="grey">{{ fallbackIcon }}</v-icon>
    </slot>
  </div>
</template>

<script setup lang="ts">
import type { FileItem } from '@/types/folder'
import { useThumbnail } from '@/composables/useThumbnail'

const props = withDefaults(
  defineProps<{
    item: FileItem
    aspectRatio?: number | string
    cover?: boolean
    fallbackIcon?: string
  }>(),
  {
    aspectRatio: 1,
    cover: false,
    fallbackIcon: 'mdi-file',
  },
)

import { toRef } from 'vue'

const { thumbnailSrc } = useThumbnail(toRef(props, 'item'))
</script>
