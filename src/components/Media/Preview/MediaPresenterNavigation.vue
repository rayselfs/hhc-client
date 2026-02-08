<template>
  <div class="media-presenter-navigation pb-4 d-flex align-center justify-center gap-4 mt-auto">
    <!-- Prev Button -->
    <liquid-btn
      icon="mdi-chevron-left"
      variant="outlined"
      class="rounded-circle mr-2"
      @click="store.prev()"
      :disabled="currentIndex <= 0"
    ></liquid-btn>

    <!-- Center: Text & Progress -->
    <div class="flex-grow-1 mr-2" style="max-width: 200px">
      <div class="text-subtitle-1 mb-1">
        {{ $t('media.slide') }} {{ currentIndex + 1 }} / {{ playlistLength }}
      </div>
      <liquid-progress :model-value="((currentIndex + 1) / playlistLength) * 100" />
    </div>

    <!-- Next Button -->
    <liquid-btn
      icon="mdi-chevron-right"
      variant="outlined"
      class="rounded-circle"
      @click="store.next()"
      :disabled="currentIndex >= playlistLength - 1"
    ></liquid-btn>
  </div>
</template>

<script setup lang="ts">
import { useMediaProjectionStore } from '@/stores/mediaProjection'

interface Props {
  currentIndex: number
  playlistLength: number
}

defineProps<Props>()

const store = useMediaProjectionStore()
</script>
