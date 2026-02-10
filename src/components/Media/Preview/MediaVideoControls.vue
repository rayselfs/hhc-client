<template>
  <div class="video-controls-container d-flex flex-column justify-center position-relative">
    <!-- Timeline Slider (Top, distinct from controls) -->
    <div
      class="timeline-wrapper position-relative w-100"
      @mousemove="handleTimelineHover"
      @mouseleave="hoverTime = null"
    >
      <v-slider
        :model-value="isDragging ? localTime : currentTime"
        :max="duration"
        :min="0"
        color="#c1e7ff"
        track-color="surface"
        thumb-size="12"
        hide-details
        density="compact"
        class="w-100 align-center px-1 mx-0"
        :readonly="disableSeeking"
        @update:model-value="handleSeekInput"
        @start="handleSeekStart"
        @end="handleSeekEnd"
      ></v-slider>

      <!-- Hover Tooltip -->
      <v-chip
        v-if="hoverTime !== null"
        class="hover-time-tooltip position-absolute px-2 py-1 text-caption"
        :style="{
          left: `${hoverX}px`,
          transform: 'translateX(-50%)',
          bottom: '100%',
          marginBottom: '4px',
        }"
        variant="tonal"
      >
        {{ disableSeeking ? $t('media.seekingDisabled') : formatTime(hoverTime) }}
      </v-chip>
    </div>

    <!-- Controls Row (Bottom, with Liquid Glass Background) -->
    <liquid-container mode="refraction" class="controls-bar align-self-start">
      <div class="d-flex align-center ga-1 py-1 pl-1 pr-2">
        <!-- Play/Pause/Reset -->
        <v-btn
          icon
          variant="text"
          size="small"
          class="control-btn mr-1"
          color="white"
          @click="handlePlayPauseClick"
        >
          <transition name="scale" mode="out-in">
            <v-icon :key="playButtonIcon">{{ playButtonIcon }}</v-icon>
          </transition>
        </v-btn>

        <!-- Volume Container (Hover to Expand) -->
        <div
          class="volume-container d-flex align-center rounded-pill px-1"
          :class="{ hovered: isVolumeHovered }"
          @mouseenter="isVolumeHovered = true"
          @mouseleave="isVolumeHovered = false"
        >
          <v-btn
            icon
            variant="text"
            size="small"
            color="white"
            class="control-btn mr-1"
            @click.stop="$emit('toggle-mute')"
          >
            <transition name="scale" mode="out-in">
              <v-icon :key="volumeIcon">{{ volumeIcon }}</v-icon>
            </transition>
          </v-btn>

          <!-- Horizontal Slider -->
          <div class="volume-slider-wrapper">
            <v-slider
              :model-value="volume"
              :max="1"
              :min="0"
              :step="0.01"
              color="white"
              track-color="rgba(255,255,255,0.2)"
              thumb-size="10"
              hide-details
              density="compact"
              class="volume-slider align-center"
              @update:model-value="$emit('volume-change', $event)"
            ></v-slider>
          </div>
        </div>

        <!-- Time Display -->
        <span
          class="text-body-1 font-weight-medium text-white user-select-none ml-2"
          style="text-align: center"
        >
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </span>
      </div>
    </liquid-container>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  isEnded?: boolean
  disableSeeking?: boolean
}>()

const emit = defineEmits<{
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'replay'): void
  (e: 'seek', time: number): void
  (e: 'seeking-start'): void
  (e: 'seeking-end', time: number): void
  (e: 'volume-change', volume: number): void
  (e: 'toggle-mute'): void
}>()

const isVolumeHovered = ref(false)
const isDragging = ref(false)
const localTime = ref(0)
const wasPlayingBeforeDrag = ref(false)

// Hover state
const hoverTime = ref<number | null>(null)
const hoverX = ref(0)

const handleTimelineHover = (e: MouseEvent) => {
  const container = e.currentTarget as HTMLElement
  if (!container) return

  const rect = container.getBoundingClientRect()
  const x = e.clientX - rect.left
  const percent = Math.max(0, Math.min(1, x / rect.width))

  hoverX.value = x
  hoverTime.value = percent * props.duration
}

// Keep localTime synced when not dragging
// This ensures that when drag/click starts, localTime assumes the correct starting position
// regardless of event order (start vs update)
import { watch } from 'vue'
watch(
  () => props.currentTime,
  (newVal) => {
    if (!isDragging.value) {
      localTime.value = newVal
    }
  },
  { immediate: true },
)

const handleSeekStart = () => {
  if (props.disableSeeking) return

  isDragging.value = true
  wasPlayingBeforeDrag.value = props.isPlaying

  // Optional: Pause while dragging for extreme stability
  if (props.isPlaying) {
    emit('pause')
  }
  emit('seeking-start')
}

const handleSeekInput = (val: number) => {
  if (props.disableSeeking) return
  localTime.value = val
  // Don't emit seek during dragging - only update local state for UI
  // The final seek will be sent in handleSeekEnd
}

const handleSeekEnd = (val?: number) => {
  if (props.disableSeeking) return

  isDragging.value = false

  // Use the event value if available, otherwise fallback to localTime
  // This handles both "Click" (where val is provided) and "Drag" scenarios
  const finalTime = typeof val === 'number' ? val : localTime.value

  // Update localTime to ensure UI reflects the final drop position
  localTime.value = finalTime

  // Emit seeking-end with the final position
  emit('seeking-end', finalTime)

  // Resume playback if it was playing
  if (wasPlayingBeforeDrag.value) {
    emit('play')
  }
}

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const playButtonIcon = computed(() => {
  if (props.isEnded) return 'mdi-refresh'
  return props.isPlaying ? 'mdi-pause' : 'mdi-play'
})

const volumeIcon = computed(() => {
  if (props.isMuted || props.volume === 0) return 'mdi-volume-off'
  if (props.volume < 0.3) return 'mdi-volume-low'
  if (props.volume < 0.7) return 'mdi-volume-medium'
  return 'mdi-volume-high'
})

const handlePlayPauseClick = () => {
  if (props.isEnded) {
    emit('replay')
  } else if (props.isPlaying) {
    emit('pause')
  } else {
    emit('play')
  }
}
</script>

<style scoped>
/* .video-controls-container {
  width: auto;
} */
/*
.video-controls-container > * {
  pointer-events: auto;
} */

.control-btn {
  font-size: 1.2rem;
}

.hover-time-tooltip {
  pointer-events: none;
  z-index: 50;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.timeline-wrapper {
  cursor: pointer;
}

/* Timeline specific styles to make it stand out */
:deep(.v-slider-track__background) {
  opacity: 0.4;
}

/* Remove animation for smoother timeline updates */
:deep(.v-slider-thumb) {
  /* Override: Disable thumb transition to avoid jitter during rapid updates */
  transition: none !important;
}

:deep(.v-slider-track__fill) {
  /* Override: Disable track fill transition for immediate UI feedback */
  transition: none !important;
}

.controls-bar {
  transition: width 0.3s ease;
}

/* Volume Slider Expansion logic */
.volume-container {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: transparent;
}

.volume-container.hovered {
  background: rgba(255, 255, 255, 0.1);
}

.volume-slider-wrapper {
  width: 0;
  overflow: hidden;
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* On hover, give it width */
.volume-container.hovered .volume-slider-wrapper {
  width: 120px; /* Increased from 80px to accommodate slider + padding */
  opacity: 1;
  padding-left: 8px;
  padding-right: 12px; /* Ensure thumb has space at the end */
}

.volume-slider {
  min-width: 100px; /* Ensure underlying slider fits within wrapper */
  /* Override: Force remove default margins from Vuetify slider */
  margin: 0 !important;
}

/* Icon Transitions */
.scale-enter-active,
.scale-leave-active {
  transition: all 0.2s ease;
}

.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
</style>
