<template>
  <div class="py-1 d-flex align-center">
    <FolderBreadcrumbs :items="breadcrumbItems" @navigate="$emit('navigate', $event)" />
    <v-spacer></v-spacer>
    <v-btn icon="mdi-view-grid-outline" variant="text" density="comfortable"></v-btn>
  </div>
</template>

<script setup lang="ts">
import FolderBreadcrumbs from '@/components/Shared/FolderBreadcrumbs.vue'

interface BreadcrumbItem {
  id: string
  name: string
}

defineProps<{
  breadcrumbItems: BreadcrumbItem[]
}>()

defineEmits<{
  (e: 'navigate', id: string): void
}>()
</script>
