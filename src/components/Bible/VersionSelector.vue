<script setup lang="ts">
import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useBibleStore } from '@/stores/bible'
import { useBible } from '@/composables/useBible'

const bibleStore = useBibleStore()
const { currentPassage, previewBook, previewVerses, isMultiVersion, secondVersionCode } =
  storeToRefs(bibleStore)

const { updateProjection } = useBible(currentPassage, previewBook, previewVerses)

/**
 * Watch multi-version state changes to update projection immediately.
 * This logic ensures that when the user toggles multi-version mode or
 * changes the second version, the projection window stays in sync.
 */
watch([isMultiVersion, secondVersionCode], async ([newIsMulti, newSecondCode]) => {
  // Only update if we have a current passage and verse
  if (currentPassage.value && currentPassage.value.verse) {
    // If enabling multi-version, we need to make sure we have a second version code
    if (newIsMulti && !newSecondCode) {
      return
    }
    await updateProjection(currentPassage.value.verse)
  }
})
</script>
