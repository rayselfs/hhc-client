<template>
  <v-dialog :model-value="modelValue" @update:model-value="updateModelValue" max-width="500">
    <v-card>
      <v-card-title class="d-flex align-center">
        <span class="mr-3">{{ title || $t('common.moveTo') }}</span>
        <!-- Folder Breadcrumbs -->
        <div class="folder-breadcrumb">
          <FolderBreadcrumbs
            :items="breadcrumbs"
            :always-enable-root="true"
            @navigate="onNavigate"
          />
        </div>
      </v-card-title>

      <v-card-text>
        <!-- Target List -->
        <div>
          <div v-if="targets.length === 0" class="text-center pa-4 text-grey">
            {{ emptyText || $t('fileExplorer.noFolder') }}
          </div>
          <div v-else>
            <div
              v-for="target in targets"
              :key="target.id"
              class="pa-3 mb-2 d-flex align-center justify-space-between rounded cursor-pointer"
              :class="
                selectedId === target.id ? 'bg-primary' : 'bg-grey-darken-4 hover-bg-grey-darken-2'
              "
              @click="onSelect(target)"
            >
              <div class="d-flex align-center">
                <v-icon class="mr-2">mdi-folder</v-icon>
                <span>{{ target.name }}</span>
              </div>
              <v-icon>mdi-chevron-right</v-icon>
            </div>
          </div>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn @click="closeDialog">{{ $t('common.cancel') }}</v-btn>
        <v-btn color="primary" @click="onConfirm" :disabled="disableConfirm" :loading="loading">
          {{ confirmText || $t('common.move') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import FolderBreadcrumbs from '@/components/Shared/FolderBreadcrumbs.vue'
import type { Folder, FolderItem } from '@/types/common'

interface Props {
  modelValue: boolean
  title?: string
  breadcrumbs: { id: string; name: string }[]
  targets: Folder<FolderItem>[] // Generic folder type
  loading?: boolean
  emptyText?: string
  confirmText?: string
  // If provided, controls the selection state externally?
  // Or simplifying: component keeps local selection state relative to targets
  // But targets change when navigating.
  // Selection logic: User selects a folder in the LIST to move INTO.
  disableConfirm?: boolean
}

const props = defineProps<Props>()

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'navigate', folderId: string): void
  (e: 'move', targetId: string): void // targetId is the folder ID to move INTO
}

const emit = defineEmits<Emits>()

const selectedId = ref<string | null>(null)

// Clear selection when targets change (navigation happened)
watch(
  () => props.targets,
  () => {
    selectedId.value = null
  },
)

// Clear selection when dialog opens/closes
watch(
  () => props.modelValue,
  (val) => {
    if (!val) selectedId.value = null
  },
)

const updateModelValue = (val: boolean) => {
  emit('update:modelValue', val)
}

const closeDialog = () => {
  emit('update:modelValue', false)
}

const onNavigate = (folderId: string) => {
  emit('navigate', folderId)
}

const onSelect = (target: Folder<FolderItem>) => {
  // If already selected, maybe double click to navigate?
  // For now: single click selects
  if (selectedId.value === target.id) {
    // Navigate into it?
    emit('navigate', target.id)
  } else {
    selectedId.value = target.id
  }
}

const onConfirm = () => {
  // Emit selected ID if present, otherwise emit empty string (implies current location)
  emit('move', selectedId.value || '')
}
</script>

<style scoped>
.hover-bg-grey-darken-2:hover {
  background-color: rgb(var(--v-theme-grey-darken-2)) !important;
}
</style>
