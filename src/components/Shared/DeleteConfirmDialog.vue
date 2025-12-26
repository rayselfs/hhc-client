<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    max-width="400"
  >
    <v-card>
      <v-card-title>{{ title || $t('common.confirmDeleteItem') }}</v-card-title>
      <v-card-text>
        <!-- Single Item/Folder -->
        <div v-if="itemName" class="mt-2 text-subtitle-1">
          <v-icon v-if="isFolder" class="mr-2">mdi-folder</v-icon>
          <span>{{ itemName }}</span>
        </div>
        <!-- Multiple Items -->
        <div v-else-if="count && count > 0" class="mt-2 text-subtitle-1">
          {{ $t('fileExplorer.selectedItems', { count }) }}
        </div>
        <div v-else class="mt-2 text-subtitle-1">
          {{ $t('common.confirmDelete') }}
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="$emit('update:modelValue', false)">{{ $t('common.cancel') }}</v-btn>
        <v-btn color="error" @click="$emit('confirm')">{{ $t('common.delete') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean
  title?: string
  itemName?: string
  isFolder?: boolean
  count?: number
}>()

defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
}>()
</script>
