<template>
  <v-row>
    <v-col cols="12">
      <v-select
        v-model="selectedLanguage"
        :items="languageOptions"
        :label="$t('settings.language')"
        item-title="text"
        item-value="value"
        variant="outlined"
        density="compact"
        rounded="lg"
        :menu-props="{ contentClass: 'rounded-lg' }"
        @update:model-value="handleLanguageChange"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="$t(item.raw.text)"></v-list-item>
        </template>
        <template v-slot:selection="{ item }">
          {{ $t(item.raw.text) }}
        </template>
      </v-select>
    </v-col>
    <v-col cols="12">
      <v-select
        v-model="selectedTimezone"
        :items="timezones"
        :label="$t('settings.timezone')"
        variant="outlined"
        density="compact"
        rounded="lg"
        :menu-props="{ contentClass: 'rounded-lg' }"
        @update:model-value="onTimezoneChange"
      ></v-select>
    </v-col>
    <v-col cols="12">
      <v-switch
        v-model="isDarkMode"
        :label="$t('settings.theme') + ': ' + $t('settings.darkMode')"
        color="primary"
        hide-details
      ></v-switch>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  selectedLanguage: string
  languageOptions: Array<{ text: string; value: string }>
  selectedTimezone: string
  timezones: Array<{ title: string; value: string }>
  isDarkMode: boolean
}

interface Emits {
  (e: 'update:selectedLanguage', value: string): void
  (e: 'update:selectedTimezone', value: string): void
  (e: 'update:isDarkMode', value: boolean): void
  (e: 'languageChange', value: string): void
  (e: 'timezoneChange', value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t: $t } = useI18n()

const selectedLanguage = computed({
  get: () => props.selectedLanguage,
  set: (value: string) => emit('update:selectedLanguage', value),
})

const selectedTimezone = computed({
  get: () => props.selectedTimezone,
  set: (value: string) => emit('update:selectedTimezone', value),
})

const isDarkMode = computed({
  get: () => props.isDarkMode,
  set: (value: boolean) => emit('update:isDarkMode', value),
})

const handleLanguageChange = (value: string) => {
  emit('languageChange', value)
}

const onTimezoneChange = (value: string) => {
  emit('timezoneChange', value)
}
</script>
