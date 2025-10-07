<script setup lang="ts">
import AlertDialog from '@/components/AlertDialog.vue'
import UpdateDialog from '@/components/UpdateDialog.vue'
import DownloadDialog from '@/components/DownloadDialog.vue'
import SnackBar from '@/components/SnackBar.vue'
import { useAlert } from '@/composables/useAlert'
import { useSnackBar } from '@/composables/useSnackBar'

const { alertState, confirm, cancel } = useAlert()
const { snackbarVisible, snackbarText, snackbarColor, snackbarTimeout, defaultConfig } =
  useSnackBar()
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
    @confirm="confirm"
    @cancel="cancel"
  />

  <!-- Update Dialogs -->
  <UpdateDialog />
  <DownloadDialog />

  <!-- Global SnackBar -->
  <SnackBar
    v-model="snackbarVisible"
    :text="snackbarText"
    :timeout="snackbarTimeout"
    :color="snackbarColor"
    :location="defaultConfig.location"
    :variant="defaultConfig.variant"
  />
</template>

<style scoped></style>
