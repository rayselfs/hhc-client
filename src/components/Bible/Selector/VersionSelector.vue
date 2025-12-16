<template>
  <div class="bible-version-selector-wrapper">
    <!-- version selector -->
    <v-select
      v-model="selectedVersionCode"
      :items="bibleVersions"
      item-title="name"
      item-value="code"
      :loading="versionsLoading || contentLoading"
      density="compact"
      variant="outlined"
      hide-details
      class="bible-version-selector mr-2"
      :disabled="versionsLoading || contentLoading"
    >
      <template v-slot:item="{ props, item }">
        <v-list-item v-bind="props" class="version-item">
          <template v-slot:append>
            <v-btn
              icon
              size="small"
              variant="text"
              @click.stop="handleItemButtonClick(item.raw.code)"
            >
              <v-icon size="small">mdi-refresh</v-icon>
            </v-btn>
          </template>
        </v-list-item>
      </template>
    </v-select>

    <!-- dropdown button -->
    <v-btn
      variant="outlined"
      :disabled="!selectedVersionCode"
      @click="showBooksDialog = true"
      :title="$t('bible.selectBooks')"
      class="books-btn"
      :class="{ 'mr-2': isMultiVersion }"
    >
      <v-icon>mdi-book-open-page-variant</v-icon>
    </v-btn>

    <!-- Second version selector -->
    <v-select
      v-if="isMultiVersion"
      v-model="secondVersionCode"
      :items="bibleVersions"
      item-title="name"
      item-value="code"
      :loading="versionsLoading || contentLoading"
      density="compact"
      variant="outlined"
      hide-details
      class="bible-version-selector"
      :disabled="versionsLoading || contentLoading"
      placeholder="Select 2nd Version"
    >
      <template v-slot:item="{ props, item }">
        <v-list-item v-bind="props" class="version-item">
          <template v-slot:append>
            <v-btn
              icon
              size="small"
              variant="text"
              @click.stop="handleItemButtonClick(item.raw.code)"
            >
              <v-icon size="small">mdi-refresh</v-icon>
            </v-btn>
          </template>
        </v-list-item>
      </template>
    </v-select>

    <!-- Multi-version toggle -->
    <v-btn
      variant="text"
      density="compact"
      icon
      :color="isMultiVersion ? 'primary' : undefined"
      @click="toggleMultiVersion"
      :title="$t('bible.multiVersion')"
      :class="!isMultiVersion ? 'ml-5' : 'ml-2'"
    >
      <v-icon>mdi-view-split-horizontal</v-icon>
    </v-btn>

    <!-- Bible Books Dialog -->
    <BooksDialog
      v-model="showBooksDialog"
      :version-code="currentVersion?.code"
      @select-verse="handleSelectVerse"
    />
  </div>
</template>

<script setup lang="ts">
defineOptions({
  name: 'BibleVersionSelector',
})

import { computed, ref, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import BooksDialog from './BooksDialog.vue'
import { useSentry } from '@/composables/useSentry'
import { useBibleStore } from '@/stores/bible'

const { reportError } = useSentry()
const { t: $t } = useI18n()

// Bible store handling versions, current selection, and cached content
const bibleStore = useBibleStore()
const { versions, versionsLoading, currentVersion, isMultiVersion, secondVersionCode } =
  storeToRefs(bibleStore)
const { loadBibleVersions, setCurrentVersionByCode, getBibleContent, setSelectedVerse } = bibleStore

const contentLoading = ref(false)
const showBooksDialog = ref(false)

const bibleVersions = computed(() => versions.value)

const selectedVersionCode = computed<string | null>({
  get: () => currentVersion.value?.code ?? null,
  set: (value) => {
    setCurrentVersionByCode(value)
  },
})

/**
 * 載入聖經內容 (優先從快取讀取)
 * @param versionCode - 版本代碼
 * @param forceRefresh - 是否強制重新 fetch
 */
const loadBibleContentForVersion = async (versionCode: string, forceRefresh = false) => {
  contentLoading.value = true

  try {
    await getBibleContent(versionCode, { forceRefresh })
  } catch (error) {
    reportError(error, {
      operation: 'load-bible-content',
      component: 'BibleVersionSelector',
      extra: { versionCode },
    })
  } finally {
    contentLoading.value = false
  }
}

// 監聽版本變化
watch(
  () => currentVersion.value?.code,
  async (newVersionCode) => {
    if (newVersionCode) {
      await loadBibleContentForVersion(newVersionCode, false)
    }
  },
  { immediate: true },
)

watch(
  () => secondVersionCode.value,
  async (newVersionCode) => {
    if (newVersionCode) {
      await loadBibleContentForVersion(newVersionCode, false)
    }
  },
  { immediate: true },
)

// 處理經文選擇
const handleSelectVerse = (bookNumber: number, chapter: number, verse: number) => {
  setSelectedVerse(bookNumber, chapter, verse)
}

const handleItemButtonClick = (versionCode: string) => {
  loadBibleContentForVersion(versionCode, true)
}

onMounted(async () => {
  if (bibleVersions.value.length === 0) {
    try {
      await loadBibleVersions()
    } catch (error) {
      reportError(error, {
        operation: 'load-bible-versions',
        component: 'BibleVersionSelector',
      })
    }
  }
})

// 暴露 selectedVersion 供外部使用
defineExpose({
  selectedVersion: computed(() => selectedVersionCode.value),
})

const toggleMultiVersion = () => {
  isMultiVersion.value = !isMultiVersion.value
}
</script>

<style scoped>
.bible-version-selector-wrapper {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 4px;
}

.bible-version-selector {
  min-width: 220px;
  max-width: 300px;
}

.bible-version-selector > .v-input__control > .v-field {
  height: 36px;
}

.refresh-btn,
.books-btn {
  height: 36px;
  margin-top: 0px;
}

.version-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.version-item :deep(.v-list-item__append) {
  padding-inline-start: 8px;
}
</style>
