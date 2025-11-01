<template>
  <div class="bible-version-selector-wrapper">
    <v-select
      v-model="selectedVersion"
      :items="bibleVersions"
      item-title="name"
      item-value="id"
      :loading="apiLoading || contentLoading"
      density="compact"
      variant="outlined"
      hide-details
      class="bible-version-selector mr-2"
      :disabled="apiLoading || contentLoading"
    >
    </v-select>

    <!-- 書卷選擇按鈕 -->
    <v-btn
      variant="outlined"
      :disabled="!selectedVersion"
      @click="showBooksDialog = true"
      :title="$t('bible.title')"
      class="books-btn"
    >
      <v-icon>mdi-book-open-page-variant</v-icon>
    </v-btn>

    <!-- 聖經書卷選擇 Dialog -->
    <BibleBooksDialog
      v-model="showBooksDialog"
      :version-id="selectedVersion"
      @select-verse="handleSelectVerse"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAPI } from '@/composables/useAPI'
import type { BibleVersion, BibleBook } from '@/types/bible'
import { useBibleCache } from '@/composables/useBibleCache'
import BibleBooksDialog from '@/components/Bible/BibleBooksDialog.vue'
import { useSentry } from '@/composables/useSentry'
import { useBasicAuth } from '@/composables/useBasicAuth'
import { useLocalStorage } from '@/composables/useLocalStorage'
import { StorageKey, StorageCategory, getStorageKey } from '@/types/common'

const { reportError } = useSentry()
const { t: $t } = useI18n()
const { loading: apiLoading, getBibleVersions, getBibleContent } = useAPI()
const { saveBibleContent, getBibleContent: getCachedContent, hasCachedContent } = useBibleCache()
const { hasCredentials } = useBasicAuth()
const { setLocalItem, getLocalItem } = useLocalStorage()

const bibleVersions = ref<BibleVersion[]>([])
const selectedVersion = ref<number | null>(null)
const contentLoading = ref(false)
const showBooksDialog = ref(false)

// 載入聖經版本列表
const loadBibleVersions = async () => {
  try {
    const versions = await getBibleVersions()
    bibleVersions.value = versions

    // 嘗試從 localStorage 讀取已選擇的版本
    const savedVersion = getLocalItem<number | null>(
      getStorageKey(StorageCategory.BIBLE, StorageKey.SELECTED_VERSION),
      'int',
    )

    // 設定預設選擇第一個版本或已保存的版本
    if (versions.length > 0) {
      if (savedVersion && versions.find((v) => v.id === savedVersion)) {
        selectedVersion.value = savedVersion
      } else if (!selectedVersion.value && versions[0]) {
        selectedVersion.value = versions[0].id
      }
    }
  } catch (error) {
    reportError(error, {
      operation: 'load-bible-versions',
      component: 'BibleVersionSelector',
    })
  }
}

/**
 * 載入聖經內容 (優先從快取讀取)
 * @param versionId - 版本 ID
 * @param forceRefresh - 是否強制重新 fetch
 */
const loadBibleContentForVersion = async (versionId: number, forceRefresh = false) => {
  contentLoading.value = true

  try {
    // 查找版本信息
    const version = bibleVersions.value.find((v) => v.id === versionId)
    if (!version) {
      reportError(new Error('Version not found'), {
        operation: 'version-not-found',
        component: 'BibleVersionSelector',
        extra: { versionId },
      })
      return
    }

    // 如果不是強制刷新，先檢查快取
    if (!forceRefresh) {
      const hasCached = await hasCachedContent(versionId)
      if (hasCached) {
        const cachedContent = await getCachedContent(versionId)
        if (cachedContent) {
          return
        }
      }
    }

    // 從 API 獲取內容
    const content = await getBibleContent(versionId)

    // 儲存到快取
    await saveBibleContent(versionId, version.code, version.name, content)
  } catch (error) {
    reportError(error, {
      operation: 'load-bible-content',
      component: 'BibleVersionSelector',
      extra: { versionId },
    })
  } finally {
    contentLoading.value = false
  }
}

// 監聽版本變化
watch(selectedVersion, async (newVersion) => {
  if (newVersion) {
    setLocalItem(getStorageKey(StorageCategory.BIBLE, StorageKey.SELECTED_VERSION), newVersion)
    await loadBibleContentForVersion(newVersion, false)
  }
})

// 處理經文選擇
const handleSelectVerse = (book: BibleBook, chapter: number, verse: number) => {
  // 發送全局事件給BibleViewer組件
  window.dispatchEvent(
    new CustomEvent('bible-verse-selected', {
      detail: { book, chapter, verse },
    }),
  )
}

// 監聽認證狀態變化，當有認證資訊時才載入聖經版本
watch(
  hasCredentials,
  (newVal) => {
    if (newVal && bibleVersions.value.length === 0) {
      // 當認證完成且還沒有載入版本時，載入聖經版本列表
      loadBibleVersions()
    }
  },
  { immediate: true }, // 立即執行一次檢查
)

// 暴露 selectedVersion 供外部使用
defineExpose({
  selectedVersion: computed(() => selectedVersion.value),
})
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
  width: 180px;
  min-width: 180px;
  max-width: 180px;
}

.bible-version-selector > .v-input__control > .v-field {
  height: 36px;
}

.refresh-btn,
.books-btn {
  height: 36px;
  margin-top: 0px;
}
</style>
