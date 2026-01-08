<template>
  <v-list density="compact" class="rounded-lg" min-width="220">
    <v-list-item
      v-if="showEdit"
      prepend-icon="mdi-pencil-outline"
      :title="$t('common.edit')"
      @click="handleEdit"
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

    <template v-if="isFolder">
      <v-list-item
        prepend-icon="mdi-content-paste"
        :title="$t('common.paste')"
        :disabled="clipboard.length === 0"
        @click="$emit('paste-into-folder')"
      ></v-list-item>
    </template>

    <v-divider class="my-2"></v-divider>
    <v-list-item
      v-if="canDelete"
      prepend-icon="mdi-delete-outline"
      :title="$t('common.delete')"
      color="error"
      @click="handleDelete"
    ></v-list-item>
  </v-list>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FileItem, Folder, ClipboardItem, ItemPermissions } from '@/types/common'
import { DEFAULT_LOCAL_PERMISSIONS } from '@/services/filesystem'

interface Props {
  target: FileItem | Folder<FileItem>
  isFolder: boolean
  clipboard: ClipboardItem<FileItem>[]
  selectedItems: Set<string>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'edit', target: FileItem | Folder<FileItem>): void
  (e: 'copy'): void
  (e: 'cut'): void
  (e: 'delete', target: FileItem | Folder<FileItem>): void
  (e: 'paste-into-folder'): void
}>()

const getPermissions = (item: FileItem | Folder<FileItem>): ItemPermissions => {
  return item.permissions || DEFAULT_LOCAL_PERMISSIONS
}

const canMove = computed(() => getPermissions(props.target).canMove)
const canDelete = computed(() => getPermissions(props.target).canDelete)
const canRename = computed(() => getPermissions(props.target).canRename)

const showEdit = computed(() => {
  if (!canRename.value) return false
  return props.selectedItems.size <= 1
})

const handleEdit = () => {
  emit('edit', props.target)
}

const handleDelete = () => {
  emit('delete', props.target)
}
</script>
