<template>
  <v-list density="compact" class="rounded-lg" min-width="200">
    <!-- Verse Content Copy (Main UI Preview) -->
    <v-list-item v-if="type === 'preview'" @click="$emit('copy-verse-text')">
      <template #prepend>
        <v-icon>mdi-content-copy</v-icon>
      </template>
      <v-list-item-title>{{ $t('bible.copyVerseContent') }}</v-list-item-title>
    </v-list-item>

    <!-- Generic Item Copy (Custom/History) -->
    <v-list-item v-if="type !== 'preview'" @click="$emit('copy')">
      <template #prepend>
        <v-icon>mdi-content-copy</v-icon>
      </template>
      <v-list-item-title>{{ $t('common.copy') }}</v-list-item-title>
    </v-list-item>

    <!-- Move (Custom only) -->
    <v-list-item v-if="type === 'custom'" @click="$emit('move')">
      <template #prepend>
        <v-icon>mdi-folder-move</v-icon>
      </template>
      <v-list-item-title>{{ $t('common.move') }}</v-list-item-title>
    </v-list-item>

    <!-- Edit (Folder only) -->
    <v-list-item v-if="isFolder" @click="$emit('edit')">
      <template #prepend>
        <v-icon>mdi-cog</v-icon>
      </template>
      <v-list-item-title>{{ $t('common.edit') }}</v-list-item-title>
    </v-list-item>

    <!-- Delete (Custom/History) -->
    <v-divider v-if="type !== 'preview'" class="my-1" />
    <v-list-item v-if="type !== 'preview'" @click="$emit('delete')" color="error">
      <template #prepend>
        <v-icon>mdi-delete</v-icon>
      </template>
      <v-list-item-title>{{ $t('common.delete') }}</v-list-item-title>
    </v-list-item>
  </v-list>
</template>

<script setup lang="ts">
interface Props {
  type: 'preview' | 'history' | 'custom'
  isFolder?: boolean
}

defineProps<Props>()

defineEmits<{
  (e: 'copy-verse-text'): void
  (e: 'copy'): void
  (e: 'move'): void
  (e: 'edit'): void
  (e: 'delete'): void
}>()
</script>
