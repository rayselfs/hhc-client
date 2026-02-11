<template>
  <v-menu>
    <template #activator="{ props }">
      <v-btn v-bind="props" variant="elevated" rounded="xl" prepend-icon="mdi-view-grid-outline">
        {{ $t('common.view') }}
      </v-btn>
    </template>
    <v-list density="compact" class="rounded-lg">
      <v-list-item
        :title="$t('media.largeIcons')"
        prepend-icon="mdi-view-grid"
        @click="emit('update:viewMode', 'large')"
      >
        <template #append>
          <v-icon v-if="viewMode === 'large'" icon="mdi-check" size="small"></v-icon>
        </template>
      </v-list-item>
      <v-list-item
        :title="$t('media.mediumIcons')"
        prepend-icon="mdi-view-module"
        @click="emit('update:viewMode', 'medium')"
      >
        <template #append>
          <v-icon v-if="viewMode === 'medium'" icon="mdi-check" size="small"></v-icon>
        </template>
      </v-list-item>
      <v-list-item
        :title="$t('media.smallIcons')"
        prepend-icon="mdi-view-comfy"
        @click="emit('update:viewMode', 'small')"
      >
        <template #append>
          <v-icon v-if="viewMode === 'small'" icon="mdi-check" size="small"></v-icon>
        </template>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import type { ViewMode } from '@/types/folder'

interface Props {
  viewMode: ViewMode
}

defineProps<Props>()

const emit = defineEmits<{
  'update:viewMode': [mode: ViewMode]
}>()
</script>
