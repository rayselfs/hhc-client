<template>
  <v-dialog v-model="isOpen" max-width="500">
    <v-card>
      <v-card-title class="text-subtitle-1 d-flex align-center">
        {{ $t('about.title') }}
      </v-card-title>

      <v-card-text class="pa-6">
        <div class="d-flex align-center mb-6">
          <v-avatar size="80" class="mr-4">
            <v-img :src="hhcIcon" alt="HHC Client"></v-img>
          </v-avatar>
          <div>
            <h2 class="text-h4 mb-2">HHC Client</h2>
            <p class="text-h6 text-grey">{{ $t('about.version') }} {{ version }}</p>
          </div>
        </div>

        <v-divider class="mb-4"></v-divider>

        <div class="mb-4">
          <h3 class="text-h6 mb-3">{{ $t('about.description') }}</h3>
          <p class="text-body-2 text-grey">
            {{ $t('about.descriptionText') }}
          </p>
        </div>

        <div class="mb-4">
          <h3 class="text-h6 mb-3">{{ $t('about.features') }}</h3>
          <v-list density="compact" class="pa-0">
            <v-list-item class="px-0">
              <template v-slot:prepend>
                <v-icon icon="mdi-book-open" color="warning" size="small"></v-icon>
              </template>
              <v-list-item-title>{{ $t('about.bibleFeature') }}</v-list-item-title>
            </v-list-item>
            <v-list-item class="px-0">
              <template v-slot:prepend>
                <v-icon icon="mdi-timer" color="success" size="small"></v-icon>
              </template>
              <v-list-item-title>{{ $t('about.timerFeature') }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </div>

        <v-divider class="mb-4"></v-divider>

        <div class="text-center">
          <p class="text-body-2 text-grey mb-2">{{ $t('about.copyright') }}</p>
          <p class="text-caption text-grey">{{ $t('about.license') }}</p>
        </div>
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="isOpen = false">
          {{ $t('close') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useElectron } from '@/composables/useElectron'
import packageJson from '../../../package.json'
import hhcIcon from '@/assets/media/hhc-icon.png'

const { t: $t } = useI18n()
const { isElectron } = useElectron()

const isOpen = ref(false)
const version = ref(packageJson.version)

const openAbout = () => {
  isOpen.value = true
}

defineExpose({
  openAbout,
})

onMounted(() => {
  if (isElectron()) {
    window.electronAPI.onMainMessage((data: unknown) => {
      if (data === 'open-about') {
        openAbout()
      }
    })
  }
})

onBeforeUnmount(() => {
  if (isElectron()) {
    window.electronAPI.removeAllListeners('main-message')
  }
})
</script>

<style scoped>
.v-avatar {
  border: 2px solid rgb(var(--v-theme-primary));
}
</style>
