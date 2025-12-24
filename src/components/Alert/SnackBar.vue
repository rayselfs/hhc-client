<template>
  <v-snackbar
    v-model="isVisible"
    :timeout="timeout"
    :color="color"
    :location="location"
    :variant="variant"
  >
    {{ text }}
  </v-snackbar>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

// Props 定義 - 保留必要功能和常用配置
interface Props {
  modelValue?: boolean
  text?: string
  timeout?: number
  color?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  location?: any
  variant?: 'flat' | 'text' | 'elevated' | 'outlined' | 'plain' | 'tonal'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  text: '',
  timeout: 5000,
  color: 'info',
  location: 'top',
  variant: 'tonal',
})

// Emits 定義 - 只保留必要事件
interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const emit = defineEmits<Emits>()

// 響應式數據
const isVisible = ref(props.modelValue)

// 監聽外部 modelValue 變化
watch(
  () => props.modelValue,
  (newValue) => {
    isVisible.value = newValue
  },
)

// 監聽內部 isVisible 變化，同步到外部
watch(isVisible, (newValue) => {
  emit('update:modelValue', newValue)
})
</script>
