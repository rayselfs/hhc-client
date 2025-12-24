<template>
  <v-dialog v-model="dialog" width="450" scrollable>
    <v-card class="rounded-lg">
      <v-card-title v-if="title" class="text-h5 pa-4 text-break">
        <v-icon v-if="icon" :icon="icon" :color="iconColor" class="mr-2"></v-icon>
        {{ title }}
      </v-card-title>

      <v-card-text class="pa-4" style="height: 80px">
        {{ message }}
      </v-card-text>

      <!-- 不要再顯示選項 -->
      <v-card-text v-if="showDontShowAgain" class="pa-4 pt-0">
        <v-checkbox
          v-model="dontShowAgain"
          :label="$t('common.dontShowAgain')"
          density="compact"
          hide-details
        />
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-spacer></v-spacer>
        <v-btn
          v-if="showCancelButton"
          variant="text"
          :color="cancelButtonColor"
          @click="handleCancel"
        >
          {{ cancelText }}
        </v-btn>
        <v-btn variant="flat" :color="confirmButtonColor" @click="handleConfirm">
          {{ confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  modelValue?: boolean
  title?: string
  message: string
  icon?: string
  iconColor?: string
  confirmButtonText?: string
  confirmButtonColor?: string
  cancelButtonText?: string
  cancelButtonColor?: string
  showCancelButton?: boolean
  maxWidth?: string | number
  showDontShowAgain?: boolean
  alertId?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  title: '',
  icon: '',
  iconColor: 'primary',
  confirmButtonText: '',
  confirmButtonColor: 'primary',
  cancelButtonText: '',
  cancelButtonColor: 'grey',
  showCancelButton: false,
  maxWidth: 500,
  showDontShowAgain: false,
  alertId: '',
})

// 使用 i18n 作為預設值
const confirmText = computed(() => props.confirmButtonText || t('common.confirm'))
const cancelText = computed(() => props.cancelButtonText || t('common.cancel'))

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
  (e: 'dont-show-again', alertId: string): void
}>()

const dialog = ref(props.modelValue)
const dontShowAgain = ref(false)

watch(
  () => props.modelValue,
  (newVal) => {
    dialog.value = newVal
  },
)

watch(dialog, (newVal) => {
  emit('update:modelValue', newVal)
})

const handleConfirm = () => {
  emit('confirm')

  // 如果用戶勾選了"不要再顯示"且有alertId
  if (dontShowAgain.value && props.alertId) {
    emit('dont-show-again', props.alertId)
  }

  dialog.value = false
}

const handleCancel = () => {
  emit('cancel')

  // 如果用戶勾選了"不要再顯示"且有alertId
  if (dontShowAgain.value && props.alertId) {
    emit('dont-show-again', props.alertId)
  }

  dialog.value = false
}
</script>

<style scoped>
.v-card-title {
  word-break: break-word;
}

.v-card-text {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
