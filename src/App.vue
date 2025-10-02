<script setup lang="ts">
import AlertDialog from '@/components/AlertDialog.vue'
import { useAlert } from '@/composables/useAlert'

const { alertState, confirm, cancel } = useAlert()
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
</template>

<style scoped></style>
