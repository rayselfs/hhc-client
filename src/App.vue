<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { AlertDialog, SnackBar } from '@/components/Alert'
import { UpdateNotification } from '@/components/Updater'
import { SettingsDialog, AboutDialog, BasicAuthDialog, ResetDialog } from '@/components/Main'
import { ShortcutsDialog } from '@/components/Shortcuts'
import { useAlert } from '@/composables/useAlert'
import { useSnackBar } from '@/composables/useSnackBar'
import { useBasicAuth } from '@/composables/useBasicAuth'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const { alertState, confirm, cancel, handleDontShowAgain } = useAlert()
const {
  snackbarVisible,
  snackbarText,
  snackbarColor,
  snackbarTimeout,
  defaultConfig,
  showSnackBar,
} = useSnackBar()
const { showAuthDialog, saveCredentials, hasCredentials } = useBasicAuth()
const { t } = useI18n()

const handleAuthConfirm = (credentials: { username: string; password: string }) => {
  saveCredentials(credentials)
  showAuthDialog.value = false
}

const handleAuthCancel = () => {
  showAuthDialog.value = false
  showSnackBar(t('auth.cancelled'), 'error')
}

onMounted(() => {
  const isProjectionWindow = route.path === '/projection'
  if (!isProjectionWindow && !hasCredentials.value) {
    showAuthDialog.value = true
  }
})
</script>

<template>
  <router-view />

  <!-- Global Alert Dialog -->
  <AlertDialog
    v-model="alertState.show"
    :title="alertState.title"
    :message="alertState.message"
    :icon="alertState.icon"
    :icon-color="alertState.iconColor"
    :confirm-button-text="alertState.confirmButtonText"
    :confirm-button-color="alertState.confirmButtonColor"
    :cancel-button-text="alertState.cancelButtonText"
    :cancel-button-color="alertState.cancelButtonColor"
    :show-cancel-button="alertState.showCancelButton"
    :max-width="alertState.maxWidth"
    :show-dont-show-again="alertState.showDontShowAgain"
    :alert-id="alertState.alertId"
    @confirm="confirm"
    @cancel="cancel"
    @dont-show-again="handleDontShowAgain"
  />

  <!-- Update Notification -->
  <UpdateNotification />

  <!-- Global SnackBar -->
  <SnackBar
    v-model="snackbarVisible"
    :text="snackbarText"
    :timeout="snackbarTimeout"
    :color="snackbarColor"
    :location="defaultConfig.location"
    :variant="defaultConfig.variant"
  />

  <!-- Global Settings Dialog -->
  <SettingsDialog />

  <!-- Global Shortcuts Dialog -->
  <ShortcutsDialog />

  <!-- Global About Dialog -->
  <AboutDialog />

  <!-- Global Basic Auth Dialog -->
  <BasicAuthDialog
    v-model="showAuthDialog"
    @confirm="handleAuthConfirm"
    @cancel="handleAuthCancel"
  />

  <!-- Global Reset Dialog -->
  <ResetDialog />
</template>

<style scoped></style>
