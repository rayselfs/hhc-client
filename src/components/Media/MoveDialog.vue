<template>
  <v-dialog v-model="isOpen" max-width="600">
    <v-card>
      <v-card-title class="text-subtitle-1 d-flex align-center mb-2">
        {{ $t('moveTo') }}
      </v-card-title>

      <!-- Breadcrumb Navigation -->
      <div v-if="breadcrumbs.length > 0" class="ml-5 mt-2">
        <v-breadcrumbs class="pa-0">
          <template v-for="(item, index) in breadcrumbs" :key="item.id">
            <v-breadcrumbs-item
              :disabled="index === breadcrumbs.length - 1"
              @click="navigateToFolder(item.id)"
              class="breadcrumb-item"
            >
              {{ item.name }}
            </v-breadcrumbs-item>
            <v-icon
              v-if="index < breadcrumbs.length - 1"
              icon="mdi-chevron-right"
              size="16"
              class="mx-2"
            />
          </template>
        </v-breadcrumbs>
      </div>

      <v-card-text class="move-dialog-content">
        <!-- Folder List -->
        <v-list>
          <!-- Home option - only show at root level -->
          <v-list-item
            v-if="currentPath.length === 1"
            @click="selectFolder('root')"
            :class="{ 'selected-folder': selectedFolderId === 'root' }"
          >
            <template #prepend>
              <v-icon icon="mdi-home" color="primary" />
            </template>
            <v-list-item-title>{{ $t('homepage') }}</v-list-item-title>
          </v-list-item>

          <!-- Folder items -->
          <v-list-item
            v-for="folder in currentFolders"
            :key="folder.id"
            @click="selectFolder(folder.id)"
            :class="{ 'selected-folder': selectedFolderId === folder.id }"
          >
            <template #prepend>
              <v-icon icon="mdi-folder" color="primary" />
            </template>
            <v-list-item-title>{{ folder.name }}</v-list-item-title>
            <template #append>
              <v-btn
                v-if="hasSubfolders(folder.id)"
                icon
                size="small"
                variant="text"
                @click.stop="navigateToFolder(folder.id)"
              >
                <v-icon icon="mdi-chevron-right" size="16" />
              </v-btn>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="cancel">
          {{ $t('cancel') }}
        </v-btn>
        <v-btn color="primary" variant="flat" @click="confirmMove" :disabled="!selectedFolderId">
          {{ $t('move') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface FolderItem {
  id: string
  name: string
  parentId: string
  createdAt: Date
}

interface BreadcrumbItem {
  id: string
  name: string
}

interface Props {
  modelValue: boolean
  folders: FolderItem[]
  currentFolder: string
  excludeFolderId?: string
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'move', targetFolderId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()

// State
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const currentPath = ref<string[]>(['root'])
const selectedFolderId = ref<string>('')

// Breadcrumbs
const breadcrumbs = computed(() => {
  const result: BreadcrumbItem[] = []
  let currentId = currentPath.value[currentPath.value.length - 1]

  while (currentId !== 'root') {
    const folder = props.folders.find((f) => f.id === currentId)
    if (folder) {
      result.unshift({ id: folder.id, name: folder.name })
      currentId = folder.parentId
    } else {
      break
    }
  }

  // Add root
  result.unshift({ id: 'root', name: t('homepage') })

  return result
})

// Current folders in the current path
const currentFolders = computed(() => {
  const currentParentId = currentPath.value[currentPath.value.length - 1]
  return props.folders
    .filter((folder) => {
      if (currentParentId === 'root') {
        return folder.parentId === 'root'
      } else {
        return folder.parentId === currentParentId
      }
    })
    .filter((folder) => folder.id !== props.excludeFolderId)
    .filter((folder) => folder.id !== props.currentFolder) // Exclude current folder to prevent circular moves
})

// Check if folder has subfolders
const hasSubfolders = (folderId: string) => {
  return props.folders.some((folder) => folder.parentId === folderId)
}

// Navigation
const navigateToFolder = (folderId: string) => {
  if (folderId === 'root') {
    currentPath.value = ['root']
  } else {
    currentPath.value.push(folderId)
  }
  selectedFolderId.value = ''
}

// Selection
const selectFolder = (folderId: string) => {
  selectedFolderId.value = folderId
}

// Actions
const confirmMove = () => {
  if (selectedFolderId.value) {
    emit('move', selectedFolderId.value)
    cancel()
  }
}

const cancel = () => {
  isOpen.value = false
  currentPath.value = ['root']
  selectedFolderId.value = ''
}

// Reset when dialog opens
watch(isOpen, (newValue) => {
  if (newValue) {
    currentPath.value = ['root']
    selectedFolderId.value = ''
  }
})
</script>

<style scoped>
.breadcrumb-item {
  cursor: pointer;
  transition: color 0.2s ease;
}

.breadcrumb-item:hover:not(.v-breadcrumbs-item--disabled) {
  color: rgb(var(--v-theme-primary));
}

.selected-folder {
  background-color: rgba(var(--v-theme-primary), 0.12) !important;
  border-left: 3px solid rgb(var(--v-theme-primary));
}

.move-dialog-content {
  height: 280px;
  overflow-y: auto;
}
</style>
