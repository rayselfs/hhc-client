<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    max-width="400"
  >
    <v-card>
      <v-card-title>{{ title }}</v-card-title>
      <v-card-text>
        <v-text-field
          ref="nameInput"
          :model-value="folderName"
          @update:model-value="$emit('update:folderName', $event)"
          :label="$t('fileExplorer.folderName')"
          :error-messages="errorMessages"
          variant="outlined"
          density="compact"
          autofocus
          @keyup.enter="$emit('confirm')"
        />

        <v-select
          v-if="showRetention"
          :model-value="retentionPeriod"
          @update:model-value="$emit('update:retentionPeriod', $event)"
          :items="retentionOptions"
          :label="$t('fileExplorer.retentionPeriod')"
          item-title="title"
          item-value="value"
          variant="outlined"
          density="compact"
          class="mt-2"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="$emit('update:modelValue', false)">{{ $t('common.cancel') }}</v-btn>
        <v-btn color="primary" @click="$emit('confirm')" :disabled="disableConfirm">{{
          confirmText
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, toRefs } from 'vue'

interface RetentionOption {
  title: string
  value: string
}

const props = defineProps<{
  modelValue: boolean
  title: string
  folderName: string
  retentionPeriod?: string
  retentionOptions?: RetentionOption[]
  errorMessages?: string | string[]
  disableConfirm?: boolean
  confirmText?: string
  showRetention?: boolean
}>()

defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:folderName', value: string): void
  (e: 'update:retentionPeriod', value: string): void
  (e: 'confirm'): void
}>()

const nameInput = ref<HTMLInputElement | null>(null)
const { modelValue } = toRefs(props)

watch(modelValue, async (val) => {
  if (val) {
    await nextTick()
    ;(nameInput.value as any)?.select()
  }
})
</script>
