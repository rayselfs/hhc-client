<template>
  <v-list density="compact" class="rounded-lg" min-width="180">
    <v-list-item :disabled="!hasClipboard" @click="$emit('paste')">
      <template #prepend>
        <v-icon>mdi-content-paste</v-icon>
      </template>
      <v-list-item-title>{{ $t('common.paste') }}</v-list-item-title>
    </v-list-item>

    <v-list-item @click="$emit('create-folder')">
      <template #prepend>
        <v-icon>mdi-folder-plus</v-icon>
      </template>
      <v-list-item-title>{{ $t('fileExplorer.newFolder') }}</v-list-item-title>
    </v-list-item>
  </v-list>
</template>

<script setup lang="ts">
interface Props {
  hasClipboard: boolean
}

defineProps<Props>()

defineEmits<{
  (e: 'paste'): void
  (e: 'create-folder'): void
}>()
</script>
