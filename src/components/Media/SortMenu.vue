<template>
  <v-menu>
    <template #activator="{ props }">
      <v-btn v-bind="props" variant="elevated" rounded="xl" prepend-icon="mdi-sort" class="mr-2">
        {{ $t('common.sort') }}
      </v-btn>
    </template>
    <v-list density="compact" class="rounded-lg">
      <v-list-item
        :title="$t('common.name')"
        prepend-icon="mdi-sort-alphabetical-variant"
        @click="emit('sort', 'name')"
      >
        <template #append>
          <v-icon
            v-if="sortBy === 'name' && sortOrder && sortOrder !== 'none'"
            :icon="sortOrder === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down'"
            size="small"
          ></v-icon>
        </template>
      </v-list-item>
      <v-list-item
        :title="$t('fileExplorer.updatedDate')"
        prepend-icon="mdi-calendar-clock"
        @click="emit('sort', 'date')"
      >
        <template #append>
          <v-icon
            v-if="sortBy === 'date' && sortOrder && sortOrder !== 'none'"
            :icon="sortOrder === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down'"
            size="small"
          ></v-icon>
        </template>
      </v-list-item>
      <v-list-item
        :title="$t('common.type')"
        prepend-icon="mdi-file-tree"
        @click="emit('sort', 'type')"
      >
        <template #append>
          <v-icon
            v-if="sortBy === 'type' && sortOrder && sortOrder !== 'none'"
            :icon="sortOrder === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down'"
            size="small"
          ></v-icon>
        </template>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import type { SortBy, SortOrder } from '@/types/folder'

interface Props {
  sortBy: SortBy
  sortOrder: SortOrder
}

defineProps<Props>()

const emit = defineEmits<{
  sort: [sortBy: SortBy]
}>()
</script>
