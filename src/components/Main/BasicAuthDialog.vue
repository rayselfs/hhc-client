<template>
  <v-dialog v-model="dialog" max-width="500" persistent>
    <v-card>
      <v-card-title class="text-h5">
        {{ $t('auth.title') }}
      </v-card-title>

      <v-card-text>
        <v-form ref="formRef" @submit.prevent="handleConfirm">
          <v-text-field
            v-model="username"
            :label="$t('auth.username')"
            :rules="[rules.required]"
            prepend-icon="mdi-account"
            variant="outlined"
            class="mb-2"
            autofocus
            @keyup.enter="handleConfirm"
          />

          <v-text-field
            v-model="password"
            :label="$t('auth.password')"
            :rules="[rules.required]"
            :type="showPassword ? 'text' : 'password'"
            prepend-icon="mdi-lock"
            :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
            variant="outlined"
            @click:append-inner="showPassword = !showPassword"
            @keyup.enter="handleConfirm"
          />

          <v-alert v-if="errorMessage" type="error" density="compact" class="mb-2">
            {{ errorMessage }}
          </v-alert>
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn color="grey" variant="text" @click="handleCancel">
          {{ $t('cancel') }}
        </v-btn>
        <v-btn color="primary" variant="text" @click="handleConfirm">
          {{ $t('confirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  modelValue: boolean
  errorMessage?: string
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', credentials: { username: string; password: string }): void
  (e: 'cancel'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

const dialog = ref(props.modelValue)
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const formRef = ref()

const rules = {
  required: (value: string) => !!value || t('auth.required'),
}

watch(
  () => props.modelValue,
  (newVal) => {
    dialog.value = newVal
    if (newVal) {
      // 重置表單
      username.value = ''
      password.value = ''
      showPassword.value = false
    }
  },
)

watch(dialog, (newVal) => {
  emit('update:modelValue', newVal)
})

const handleConfirm = async () => {
  const { valid } = await formRef.value?.validate()
  if (valid) {
    emit('confirm', {
      username: username.value,
      password: password.value,
    })
  }
}

const handleCancel = () => {
  emit('cancel')
  dialog.value = false
}
</script>

<style scoped></style>
