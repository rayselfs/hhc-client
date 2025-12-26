<template>
  <div class="d-flex align-center bg-grey-darken-4 rounded-lg w-100">
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
      icon="mdi-folder-move-outline"
      size="small"
      variant="text"
      density="comfortable"
      class="mr-2"
      :title="$t('common.move')"
      @click="$emit('move')"
    ></v-btn>
    <v-btn
      icon="mdi-trash-can-outline"
      size="small"
      variant="text"
      density="comfortable"
      class="mr-2"
      :title="$t('common.delete')"
      @click="$emit('delete')"
    ></v-btn>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  selectedCount: number
}>()

defineEmits<{
  (e: 'clear'): void
  (e: 'move'): void
  (e: 'delete'): void
}>()
</script>
