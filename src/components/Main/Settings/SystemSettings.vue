<template>
  <v-row>
    <v-col cols="12">
      <v-switch
        v-model="hardwareAcceleration"
        :label="$t('settings.hardwareAcceleration')"
        color="primary"
        @update:model-value="onHardwareAccelerationChange"
      ></v-switch>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  hardwareAcceleration: boolean
}

interface Emits {
  (e: 'update:hardwareAcceleration', value: boolean): void
  (e: 'hardwareAccelerationChange', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t: $t } = useI18n()

const hardwareAcceleration = computed({
  get: () => props.hardwareAcceleration,
  set: (value: boolean) => emit('update:hardwareAcceleration', value),
})

const onHardwareAccelerationChange = (value: boolean | null) => {
  if (value !== null) {
    emit('hardwareAccelerationChange', value)
  }
}
</script>
