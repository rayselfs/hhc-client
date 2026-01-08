<template>
  <div
    class="rounded-lg file-item user-select-none d-flex flex-column h-100 position-relative"
    style="aspect-ratio: 1; max-width: 100%"
    :class="[
      isSelected ? 'bg-primary' : 'bg-grey-darken-4 hover-bg-grey-darken-2',
      { 'item-cut': isCut },
    ]"
    :data-id="item.id"
  >
    <!-- Header Info -->
    <div class="d-flex align-center px-3 pt-2 pb-1 w-100 overflow-hidden">
      <v-icon
        :icon="getFileIcon(item.metadata.fileType)"
        color="red"
        size="small"
        class="mr-2 flex-shrink-0"
      ></v-icon>
      <span
        class="py-2 text-body-2 text-truncate flex-grow-1"
        style="min-width: 0"
        :title="item.name"
        >{{ item.name }}</span
      >
      <v-menu location="bottom end">
        <template #activator="{ props: menuProps }">
          <v-btn
            icon="mdi-dots-vertical"
            variant="text"
            density="compact"
            size="small"
            v-bind="menuProps"
            @click.stop
          ></v-btn>
        </template>
        <v-list width="150" density="compact" class="rounded-lg elevation-2">
          <v-list-item
            v-if="canRename"
            prepend-icon="mdi-pencil-outline"
            :title="$t('common.edit')"
            @click="$emit('edit', item)"
          ></v-list-item>
          <v-list-item
            prepend-icon="mdi-content-copy"
            :title="$t('common.copy')"
            @click="$emit('copy')"
          ></v-list-item>
          <v-list-item
            v-if="canMove"
            prepend-icon="mdi-content-cut"
            :title="$t('common.cut')"
            @click="$emit('cut')"
          ></v-list-item>
          <v-list-item
            v-if="canDelete"
            prepend-icon="mdi-delete-outline"
            :title="$t('common.delete')"
            color="error"
            @click="$emit('delete', item)"
          ></v-list-item>
        </v-list>
      </v-menu>
    </div>

    <!-- Image / Thumbnail / Icon Area -->
    <div class="flex-grow-1 mx-2 mb-2 rounded overflow-hidden position-relative bg-grey-darken-3">
      <!-- Image/Thumbnail -->
      <v-img
        v-if="
          item.metadata.fileType === 'image' ||
          item.metadata.thumbnail ||
          item.metadata.thumbnailBlobId
        "
        :src="thumbnailSrc"
        cover
        class="h-100 w-100 bg-grey-darken-3"
      >
        <!-- Type Indicator for Video -->
        <div
          v-if="item.metadata.fileType === 'video'"
          class="d-flex justify-end pa-2 w-100 h-100 align-end"
        >
          <v-btn
            icon="mdi-play-circle"
            variant="text"
            color="white"
            size="small"
            class="bg-black-alpha-50 rounded-circle"
          ></v-btn>
        </div>

        <template #error>
          <div class="d-flex align-center justify-center h-100 w-100 bg-grey-darken-3">
            <v-icon :icon="getFileIcon(item.metadata.fileType)" size="64" color="grey"></v-icon>
          </div>
        </template>
      </v-img>

      <!-- Icon for other types -->
      <div v-else class="d-flex align-center justify-center h-100 w-100">
        <v-icon
          :icon="getFileIcon(item.metadata.fileType)"
          size="64"
          :color="item.metadata.fileType === 'pdf' ? 'red' : 'grey'"
        ></v-icon>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FileItem, ItemPermissions } from '@/types/common'
import { DEFAULT_LOCAL_PERMISSIONS } from '@/services/filesystem'
import { useThumbnail } from '@/composables/useThumbnail'

const props = defineProps<{
  item: FileItem
  isSelected: boolean
  isCut: boolean
}>()

defineEmits<{
  (e: 'edit', item: FileItem): void
  (e: 'copy'): void
  (e: 'cut'): void
  (e: 'delete', item: FileItem): void
}>()

const { thumbnailSrc } = useThumbnail(props.item)

const getPermissions = (item: FileItem): ItemPermissions => {
  return item.permissions || DEFAULT_LOCAL_PERMISSIONS
}

const canMove = computed(() => getPermissions(props.item).canMove)
const canDelete = computed(() => getPermissions(props.item).canDelete)
const canRename = computed(() => getPermissions(props.item).canRename)

const getFileIcon = (fileType: string) => {
  switch (fileType) {
    case 'image':
      return 'mdi-image'
    case 'video':
      return 'mdi-file-video'
    case 'pdf':
      return 'mdi-file-pdf-box'
    default:
      return 'mdi-file'
  }
}
</script>

<style scoped>
.hover-bg-grey-darken-2:hover {
  background-color: rgb(var(--v-theme-grey-darken-2)) !important;
}

.item-cut {
  opacity: 0.5;
}

.file-item {
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.file-item:hover {
  border-color: rgba(var(--v-theme-primary), 0.5);
}

.bg-black-alpha-50 {
  background-color: rgba(0, 0, 0, 0.5);
}
</style>
