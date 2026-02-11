<template>
  <div class="d-flex align-center ga-2">
    <v-text-field
      v-if="currentStep === 'books'"
      :model-value="searchQuery"
      :placeholder="$t('bible.searchBooks')"
      variant="plain"
      density="compact"
      hide-details
      clearable
      prepend-inner-icon="mdi-magnify"
      class="search-field"
      max-width="200"
      min-width="150"
      @update:model-value="emit('update:searchQuery', $event)"
    />

    <v-btn
      size="small"
      class="text-subtitle-1"
      :color="currentStep === 'books' ? 'primary' : 'default'"
      :variant="currentStep === 'books' ? 'flat' : 'elevated'"
      :disabled="false"
      rounded="xl"
      @click="emit('navigate', 'books')"
    >
      {{ $t('bible.navigateBook') }}
    </v-btn>
    <v-btn
      size="small"
      class="text-subtitle-1"
      :color="currentStep === 'chapters' ? 'primary' : 'default'"
      :variant="currentStep === 'chapters' ? 'flat' : 'elevated'"
      :disabled="!canNavigateToChapter"
      rounded="xl"
      @click="emit('navigate', 'chapters')"
    >
      {{ $t('bible.navigateChapter') }}
    </v-btn>
    <v-btn
      size="small"
      class="text-subtitle-1"
      :color="currentStep === 'verses' ? 'primary' : 'default'"
      :variant="currentStep === 'verses' ? 'flat' : 'elevated'"
      :disabled="!canNavigateToVerse"
      rounded="xl"
      @click="emit('navigate', 'verses')"
    >
      {{ $t('bible.navigateVerse') }}
    </v-btn>
  </div>
</template>

<script setup lang="ts">
type Step = 'books' | 'chapters' | 'verses'

interface Props {
  currentStep: Step
  searchQuery: string
  canNavigateToChapter: boolean
  canNavigateToVerse: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  navigate: [step: Step]
  'update:searchQuery': [query: string]
}>()
</script>
