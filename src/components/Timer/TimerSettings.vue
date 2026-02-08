<template>
  <v-card :style="{ height: `${height}px` }" rounded="lg">
    <v-card-text>
      <v-label class="text-h6 align-start mb-4">{{ $t('common.control') }}</v-label>
      <div class="d-flex align-center fill-height">
        <liquid-switch
          v-model="stopwatchStore.global.isStopwatchMode"
          :label="$t('timer.stopwatch')"
          color="primary"
        />
      </div>
      <div class="d-flex align-center mt-4">
        <liquid-switch
          v-model="reminderEnabled"
          :label="$t('timer.reminder')"
          color="primary"
          class="mr-4"
        />
        <liquid-text-field
          v-model="reminderTimeInput"
          type="number"
          style="max-width: 100px"
          :suffix="$t('timer.reminderSecond')"
          :disabled="timerStore.state !== 'stopped'"
          rounded
          @update:model-value="handleReminderTimeChange"
        />
      </div>
      <div class="d-flex align-center mt-4">
        <liquid-switch
          v-model="overtimeMessageEnabled"
          :label="$t('timer.overtimeMessage')"
          color="primary"
          class="mr-4"
        />
        <liquid-text-field
          v-model="overtimeMessageInput"
          :placeholder="$t('timer.overtimeMessageLabel')"
          :maxlength="TIMER_CONFIG.OVERTIME_MESSAGE.MAX_LENGTH"
          style="max-width: 250px"
          rounded
          @blur="handleOvertimeMessageBlur"
          @keyup:enter="handleOvertimeMessageEnter"
        />
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTimerStore } from '@/stores/timer'
import { useStopwatchStore } from '@/stores/stopwatch'
import { useSnackBar } from '@/composables/useSnackBar'
import { TIMER_CONFIG } from '@/config/app'

interface Props {
  height?: number | string
}

withDefaults(defineProps<Props>(), {
  height: 'auto',
})

const timerStore = useTimerStore()
const stopwatchStore = useStopwatchStore()
const { t: $t } = useI18n()
const { showSnackBar } = useSnackBar()

const reminderEnabled = computed({
  get: () => timerStore.settings.reminderEnabled,
  set: (value) => {
    timerStore.setReminder(value, timerStore.settings.reminderTime)
  },
})

const reminderTimeInput = computed({
  get: () => timerStore.settings.reminderTime,
  set: () => {},
})

const handleReminderTimeChange = (value: string | number) => {
  const seconds = parseInt(String(value))
  if (isNaN(seconds) || seconds < 0) {
    return
  }
  if (seconds >= timerStore.settings.originalDuration) {
    showSnackBar($t('timer.reminderError'), {
      color: 'warning',
    })
    timerStore.setReminder(timerStore.settings.reminderEnabled, 0)
  } else {
    timerStore.setReminder(timerStore.settings.reminderEnabled, seconds)
  }
}

const overtimeMessageEnabled = computed({
  get: () => timerStore.settings.overtimeMessageEnabled,
  set: (value) => {
    timerStore.setOvertimeMessage(value, timerStore.settings.overtimeMessage)
  },
})

const overtimeMessageInput = computed({
  get: () => timerStore.settings.overtimeMessage,
  set: (value) => {
    timerStore.setOvertimeMessage(timerStore.settings.overtimeMessageEnabled, value)
  },
})

const handleOvertimeMessageBlur = () => {
  if (!overtimeMessageInput.value || overtimeMessageInput.value.trim() === '') {
    showSnackBar($t('timer.overtimeMessageError'), {
      color: 'warning',
    })
    timerStore.setOvertimeMessage(timerStore.settings.overtimeMessageEnabled, "Time's Up!")
  }
}

const handleOvertimeMessageEnter = (event: Event) => {
  const target = event.target as HTMLInputElement
  target?.blur()
}
</script>
