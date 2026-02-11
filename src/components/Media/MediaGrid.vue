<template>
  <div v-if="items.length > 0" class="media-grid-container" style="height: 100%">
    <!-- Virtual Scroll for large lists (No animation, just performance) -->
    <v-virtual-scroll
      v-if="useVirtualScroll"
      :items="chunkedItems"
      style="height: 100%"
      class="overflow-y-auto overflow-x-hidden"
    >
      <template #default="{ item: rowItems }">
        <div class="d-flex flex-wrap">
          <slot name="item" v-for="item in rowItems" :key="item.id" :item="item" :is-virtual="true">
          </slot>
        </div>
      </template>
    </v-virtual-scroll>

    <!-- Standard Flex Layout for manual sort and visual feedback -->
    <div v-else class="overflow-y-auto overflow-x-hidden" style="height: 100%">
      <transition-group name="media-list" tag="div" class="d-flex flex-wrap ga-1">
        <slot
          name="item"
          v-for="item in localItems"
          :key="item.id"
          :item="item"
          :is-virtual="false"
        >
        </slot>
      </transition-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FileItem, Folder } from '@/types/folder'

type UnifiedItem = FileItem | Folder<FileItem>

defineProps<{
  items: UnifiedItem[]
  localItems: UnifiedItem[]
  useVirtualScroll: boolean
  chunkedItems: UnifiedItem[][]
}>()
</script>

<style scoped>
/* Transition Group Styles from original component */
.media-list-move,
.media-list-enter-active,
.media-list-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.5, 1);
}

.media-list-enter-from,
.media-list-leave-to {
  opacity: 0;
  transform: scale(0.5);
}

.media-list-leave-active {
  position: absolute;
}
</style>
