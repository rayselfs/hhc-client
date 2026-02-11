<template>
  <v-list density="compact" class="rounded-lg" min-width="220">
    <v-list-item
      prepend-icon="mdi-folder-plus-outline"
      :title="$t('fileExplorer.newFolder')"
      @click="$emit('create-folder')"
    ></v-list-item>

    <v-divider class="my-2"></v-divider>

    <v-list-item
      prepend-icon="mdi-file-upload-outline"
      :title="$t('fileExplorer.fileUpload')"
      @click="$emit('upload-file')"
    ></v-list-item>

    <v-list-item
      prepend-icon="mdi-folder-upload-outline"
      :title="$t('fileExplorer.folderUpload')"
      @click="$emit('upload-folder')"
    ></v-list-item>

    <template v-if="!isFab">
      <v-divider class="my-2"></v-divider>
      <v-list-item
        prepend-icon="mdi-content-paste"
        :title="$t('common.paste')"
        :disabled="clipboard.length === 0"
        @click="$emit('paste')"
      ></v-list-item>
    </template>
  </v-list>
</template>

<script setup lang="ts">
import type { ClipboardItem, FileItem } from '@/types/folder'

interface Props {
  isFab?: boolean
  clipboard?: ClipboardItem<FileItem>[]
}

withDefaults(defineProps<Props>(), {
  isFab: false,
  clipboard: () => [],
})

defineEmits<{
  (e: 'create-folder'): void
  (e: 'upload-file'): void
  (e: 'upload-folder'): void
  (e: 'paste'): void
}>()
</script>
