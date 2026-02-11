<template>
  <div class="d-flex align-center">
    <span class="text-subtitle-1">
      {{ $t('bible.title') }}
    </span>
    <v-icon v-if="selectedBook" size="small" class="mx-1 breadcrumb-icon">mdi-chevron-right</v-icon>
    <span v-if="selectedBook" class="text-subtitle-1">
      {{ selectedBookName }}
    </span>
    <v-icon v-if="selectedChapter" size="small" class="mx-1 breadcrumb-icon"
      >mdi-chevron-right</v-icon
    >
    <span v-if="selectedChapter" class="text-subtitle-1"> {{ selectedChapter }}</span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  selectedBook?: { number: number } | null
  selectedBookName: string
  selectedChapter?: number | null
}

defineProps<Props>()
</script>
