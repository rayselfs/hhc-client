<template>
  <div class="global-dialogs">
    <FloatingTimer />
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
    <UpdateNotification />
    <SnackBar
      v-model="snackbarVisible"
      :text="snackbarText"
      :timeout="snackbarTimeout"
      :color="snackbarColor"
      :location="snackbarLocation"
      :variant="defaultConfig.variant"
    />
    <SettingsDialog />
    <ShortcutsDialog />
    <AboutDialog />
    <ResetDialog />
  </div>
</template>

<script setup lang="ts">
import FloatingTimer from '@/components/Timer/FloatingTimer.vue'
import { AlertDialog, SnackBar } from '@/components/Alert'
import { UpdateNotification } from '@/components/Updater'
import { SettingsDialog, AboutDialog, ResetDialog } from '@/components/Main'
import { ShortcutsDialog } from '@/components/Shortcuts'
import { useAlert } from '@/composables/useAlert'
import { useSnackBar } from '@/composables/useSnackBar'

const { alertState, confirm, cancel, handleDontShowAgain } = useAlert()
const {
  snackbarVisible,
  snackbarText,
  snackbarColor,
  snackbarTimeout,
  snackbarLocation,
  defaultConfig,
} = useSnackBar()
</script>
