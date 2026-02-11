<template>
  <div>
    <h3 class="text-subtitle-2 mb-2">{{ $t('settings.media.ffmpegStatus') }}</h3>
    <div class="mb-2">
      <v-chip
        :color="ffmpegStatus.available ? 'success' : 'warning'"
        size="small"
        class="mb-2"
        :aria-label="
          $t('settings.media.ffmpegStatus') +
          ': ' +
          (ffmpegStatus.available ? 'Available' : 'Not found')
        "
      >
        {{
          ffmpegStatus.available
            ? $t('settings.media.ffmpegFound', { version: ffmpegStatus.version })
            : $t('settings.media.ffmpegNotFound')
        }}
      </v-chip>
    </div>
    <p v-if="ffmpegStatus.path" class="text-caption text-medium-emphasis mb-4">
      {{ ffmpegStatus.path }}
    </p>

    <v-text-field
      v-model="customFfmpegPath"
      :label="$t('settings.media.customFfmpegPath')"
      :placeholder="$t('settings.media.customFfmpegPathPlaceholder')"
      :hint="$t('settings.media.customFfmpegPathHint')"
      variant="outlined"
      density="compact"
      clearable
      persistent-hint
      class="mb-4"
      rounded="lg"
      @blur="onCustomPathChange"
    />

    <div class="d-flex align-center mb-2">
      <v-switch
        v-model="enableFfmpeg"
        :label="$t('settings.media.enableExtendedVideo')"
        :disabled="!ffmpegStatus.available"
        color="primary"
        hide-details
        @update:model-value="onEnableFfmpegChange"
      />
      <v-btn
        icon
        variant="text"
        size="small"
        :aria-label="$t('settings.media.ffmpegInstallGuide')"
        @click="emit('showInstallGuide')"
      >
        <v-icon size="small">mdi-help-circle-outline</v-icon>
      </v-btn>
    </div>
    <p class="text-caption text-medium-emphasis mb-4">
      {{ $t('settings.media.enableExtendedVideoHint') }}
    </p>
    <p v-if="!ffmpegStatus.available" class="text-caption text-error mb-4" role="alert">
      {{ $t('settings.media.ffmpegRequiredToEnable') }}
    </p>

    <v-select
      v-model="videoQuality"
      :items="videoQualityOptions"
      :label="$t('settings.videoQuality')"
      :disabled="!enableFfmpeg"
      item-title="text"
      item-value="value"
      variant="outlined"
      density="compact"
      rounded="lg"
      :menu-props="{ contentClass: 'rounded-lg' }"
      @update:model-value="onVideoQualityChange"
    >
      <template v-slot:item="{ props, item }">
        <v-list-item v-bind="props" :title="$t(item.raw.text)">
          <template v-slot:subtitle>
            {{ $t(item.raw.description) }}
          </template>
        </v-list-item>
      </template>
      <template v-slot:selection="{ item }">
        {{ $t(item.raw.text) }}
      </template>
    </v-select>
    <p class="text-caption text-medium-emphasis mt-1">
      {{ $t('settings.videoQualityHint') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FFmpegStatus } from '@/types/electron'

interface Props {
  ffmpegStatus: FFmpegStatus
  customFfmpegPath: string
  enableFfmpeg: boolean
  videoQuality: 'low' | 'medium' | 'high'
  videoQualityOptions: Array<{
    text: string
    value: string
    description: string
  }>
}

interface Emits {
  (e: 'update:customFfmpegPath', value: string): void
  (e: 'update:enableFfmpeg', value: boolean): void
  (e: 'update:videoQuality', value: 'low' | 'medium' | 'high'): void
  (e: 'customPathChange'): void
  (e: 'enableFfmpegChange', value: boolean): void
  (e: 'videoQualityChange', value: 'low' | 'medium' | 'high'): void
  (e: 'showInstallGuide'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t: $t } = useI18n()

const customFfmpegPath = computed({
  get: () => props.customFfmpegPath,
  set: (value: string) => emit('update:customFfmpegPath', value),
})

const enableFfmpeg = computed({
  get: () => props.enableFfmpeg,
  set: (value: boolean) => emit('update:enableFfmpeg', value),
})

const videoQuality = computed({
  get: () => props.videoQuality,
  set: (value: 'low' | 'medium' | 'high') => emit('update:videoQuality', value),
})

const onCustomPathChange = () => {
  emit('customPathChange')
}

const onEnableFfmpegChange = (value: boolean | null) => {
  if (value !== null) {
    emit('enableFfmpegChange', value)
  }
}

const onVideoQualityChange = (value: 'low' | 'medium' | 'high') => {
  emit('videoQualityChange', value)
}
</script>
