<template>
  <v-text-field
    v-model="model"
    variant="plain"
    density="compact"
    hide-details
    class="time-input-field"
    placeholder="00"
    inputmode="numeric"
    pattern="[0-9]*"
    autocomplete="off"
    @keydown="handleKeydown"
    @focus="handleFocus"
    @blur="handleBlur"
    @paste="handlePaste"
    @compositionstart="handleCompositionStart"
  ></v-text-field>
</template>

<script setup lang="ts">
import { nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()
const model = defineModel<string>({ required: true })

const props = defineProps<{
  onError?: (msg: string) => void
}>()

const handleCompositionStart = () => {
  props.onError?.($t('alert.useEnglishInput'))
}

const handleKeydown = (event: KeyboardEvent) => {
  // Check for IME usage first
  if (event.isComposing || event.key === 'Process') {
    event.preventDefault()
    props.onError?.($t('alert.useEnglishInput'))
    return
  }

  // Allow: backspace, delete, tab, escape, enter, numbers
  const allowedKeys = [
    'Backspace',
    'Delete',
    'Tab',
    'Escape',
    'Enter',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
  ]
  if (allowedKeys.includes(event.key)) {
    return
  }
  // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
  if ((event.ctrlKey || event.metaKey) && ['a', 'c', 'v', 'x'].includes(event.key.toLowerCase())) {
    return
  }
  // Ensure that it is a number and stop the keypress
  if (!/^\d$/.test(event.key)) {
    event.preventDefault()
  }
}

const handlePaste = (event: ClipboardEvent) => {
  const paste = event.clipboardData?.getData('text')
  if (paste && !/^\d*$/.test(paste)) {
    event.preventDefault()
    props.onError?.('Only numbers are allowed')
  }
}

const handleFocus = (event: FocusEvent) => {
  const target = event.target as HTMLInputElement
  if (target) {
    nextTick(() => {
      target.select()
    })
  }
}

const handleBlur = () => {
  // Pad with zero if single digit
  if (model.value.length === 1) {
    model.value = model.value.padStart(2, '0')
  }
}
</script>

<style scoped>
.time-input-field {
  width: 90px;
}

.time-input-field :deep(.v-field__input) {
  text-align: center;
  font-size: 77px;
  font-weight: 500;
  padding: 0;
  min-height: auto;
  transition: all 0.2s ease;
}

.time-input-field :deep(.v-field__input::placeholder) {
  color: rgba(var(--v-theme-on-surface), 0.4);
  font-size: 77px;
  font-weight: 500;
}

.time-input-field:focus-within :deep(.v-field__input) {
  background-color: rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 8px;
}
</style>
