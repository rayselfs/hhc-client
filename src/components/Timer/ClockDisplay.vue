<template>
  <div class="clock-text" :style="{ fontSize: `${props.size}px` }">
    {{ clockFormattedTime }}
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeMount, onBeforeUnmount } from 'vue'

interface Props {
  timezone: string
  size: number
}

const props = defineProps<Props>()

// 立即獲取當前時間，避免顯示 12:00:00
const getCurrentTime = () => {
  const now = new Date()
  return now.toLocaleTimeString('en-US', {
    timeZone: props.timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

const clockFormattedTime = ref(getCurrentTime())

// 計時器
let timer: number | undefined

// 啟動計時器
const startClock = () => {
  timer = window.setInterval(() => {
    clockFormattedTime.value = getCurrentTime()
  }, 1000)
}

// 停止計時器
const stopClock = () => {
  if (timer) {
    clearInterval(timer)
    timer = undefined
  }
}

// 暴露方法給父組件
defineExpose({
  clockFormattedTime,
  startClock,
  stopClock,
})

// 生命週期
onBeforeMount(() => {
  startClock()
})

onBeforeUnmount(() => {
  stopClock()
})
</script>

<style scoped>
.clock-text {
  font-weight: 600;
}
</style>
