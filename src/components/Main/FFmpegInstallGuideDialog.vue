<template>
  <v-dialog v-model="isOpen" max-width="500">
    <v-card>
      <v-card-title class="d-flex align-center">
        {{ $t('settings.media.installGuide.title') }}
        <v-spacer />
        <v-btn icon variant="text" @click="isOpen = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      <v-card-text>
        <!-- Windows Section -->
        <div class="mb-4">
          <div class="text-subtitle-1 font-weight-bold mb-2">
            <v-icon size="small" class="mr-1">mdi-microsoft-windows</v-icon>
            Windows
          </div>
          <ol class="text-body-2 ml-4">
            <i18n-t keypath="settings.media.installGuide.windows.step1" tag="li" scope="global">
              <template #gyan>
                <a href="https://www.gyan.dev/ffmpeg/builds/" target="_blank">gyan.dev</a>
              </template>
              <template #github>
                <a href="https://github.com/BtbN/FFmpeg-Builds/releases" target="_blank">GitHub</a>
              </template>
            </i18n-t>
            <li>{{ $t('settings.media.installGuide.windows.step2') }}</li>
            <li>{{ $t('settings.media.installGuide.windows.step3') }}</li>
            <li>{{ $t('settings.media.installGuide.windows.step4') }}</li>
          </ol>
        </div>

        <!-- macOS Section -->
        <div class="mb-4">
          <div class="text-subtitle-1 font-weight-bold mb-2">
            <v-icon size="small" class="mr-1">mdi-apple</v-icon>
            macOS
          </div>
          <div class="text-subtitle-2 mb-1">
            {{ $t('settings.media.installGuide.macOS.option1Title') }}
          </div>
          <ol class="text-body-2 mb-2 ml-4">
            <li>{{ $t('settings.media.installGuide.macOS.option1Step1') }}</li>
            <li>{{ $t('settings.media.installGuide.macOS.option1Step2') }}</li>
            <li>{{ $t('settings.media.installGuide.macOS.option1Step3') }}</li>
          </ol>
          <div class="text-subtitle-2 mb-1">
            {{ $t('settings.media.installGuide.macOS.option2Title') }}
          </div>
          <ol class="text-body-2 ml-4">
            <i18n-t
              keypath="settings.media.installGuide.macOS.option2Step1"
              tag="li"
              scope="global"
            >
              <template #evermeet>
                <a href="https://evermeet.cx/ffmpeg/" target="_blank">evermeet.cx/ffmpeg</a>
              </template>
            </i18n-t>
            <li>{{ $t('settings.media.installGuide.macOS.option2Step2') }}</li>
            <li>{{ $t('settings.media.installGuide.macOS.option2Step3') }}</li>
          </ol>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
const isOpen = defineModel<boolean>({ default: false })
</script>
