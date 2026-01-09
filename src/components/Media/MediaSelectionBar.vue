<template>
  <v-sheet class="d-flex align-center rounded-lg w-100">
    <v-btn
      icon="mdi-close"
      variant="text"
      density="comfortable"
      class="mr-3"
      @click="$emit('clear')"
    ></v-btn>
    <span class="text-subtitle-1 font-weight-medium mr-4">{{
      $t('common.selectedItems', { count: selectedCount })
    }}</span>
    <v-btn
      v-if="selectedCount === 1"
      icon="mdi-pencil-outline"
      size="small"
      variant="text"
      density="comfortable"
      class="mr-2"
      :title="$t('common.edit')"
      @click="$emit('edit')"
    ></v-btn>
    <v-btn
      icon="mdi-content-copy"
      size="small"
      variant="text"
      density="comfortable"
      class="mr-2"
      :title="$t('common.copy')"
      @click="$emit('copy')"
    ></v-btn>
    <v-btn
      icon="mdi-content-cut"
      size="small"
      variant="text"
      density="comfortable"
      class="mr-2"
      :title="$t('common.cut')"
      @click="$emit('cut')"
    ></v-btn>
    <v-btn
      icon="mdi-delete-outline"
      size="small"
      variant="text"
      density="comfortable"
      class="mr-2"
      :title="$t('common.delete')"
      @click="$emit('delete')"
    ></v-btn>
  </v-sheet>
</template>

<script setup lang="ts">
defineProps<{
  selectedCount: number
}>()

defineEmits<{
  (e: 'clear'): void
  (e: 'edit'): void
  (e: 'copy'): void
  (e: 'cut'): void
  (e: 'delete'): void
}>()
</script>
