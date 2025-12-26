<template>
  <div class="d-flex align-center flex-wrap">
    <!-- Root/Home Button -->
    <v-btn
      size="small"
      class="pa-0 text-subtitle-1"
      variant="text"
      :disabled="items.length <= 1 && !alwaysEnableRoot"
      @click="items[0] && $emit('navigate', items[0].id)"
    >
      <v-icon class="mr-1">mdi-home</v-icon>
      {{ $t('common.homepage') }}
    </v-btn>

    <!-- Path Segments -->
    <template v-for="(item, index) in items.slice(1)" :key="item.id">
      <v-icon size="x-small" class="ml-1 mr-1">mdi-chevron-right</v-icon>
      <v-btn
        size="small"
        class="pa-0 text-subtitle-1"
        variant="text"
        :disabled="index === items.length - 2"
        @click="$emit('navigate', item.id)"
      >
        <v-icon class="mr-1">mdi-folder</v-icon>
        {{ item.name }}
      </v-btn>
    </template>
  </div>
</template>

<script setup lang="ts">
interface BreadcrumbItem {
  id: string
  name: string
}

interface Props {
  items: BreadcrumbItem[]
  alwaysEnableRoot?: boolean
}

defineProps<Props>()
defineEmits<{
  (e: 'navigate', id: string): void
}>()
</script>

<style scoped>
/* Ensure buttons don't have excessive padding/margin that breaks flow */
.v-btn {
  min-width: auto;
  height: auto;
}
</style>
