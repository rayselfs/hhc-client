<template>
  <div
    class="liquid-glass-wrapper position-relative"
    :class="[
      rounded,
      mode === 'simple' ? 'simple-mode' : '',
      mode === 'refraction' ? 'refraction-mode' : '',
      mode === 'ghost' ? 'ghost-mode' : '',
    ]"
  >
    <template v-if="mode === 'advanced' || mode === 'refraction'">
      <!-- 1. The Distortion Layer (Background) -->
      <div class="liquid-glass-effect" :class="rounded"></div>

      <!-- 2. The Tint Layer (Color) -->
      <div class="liquid-glass-tint" :class="rounded"></div>

      <!-- 3. The Shine Layer (Border/Glow) -->
      <div class="liquid-glass-shine" :class="rounded"></div>
    </template>

    <!-- 4. Content Slot (Foreground) -->
    <div
      class="liquid-glass-content position-relative d-flex align-center"
      :class="[rounded, padding]"
      style="z-index: 3"
    >
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  rounded?: string
  padding?: string
  mode?: 'advanced' | 'simple' | 'refraction' | 'ghost'
}

withDefaults(defineProps<Props>(), {
  rounded: 'rounded-pill',
  padding: 'px-4 py-2',
  mode: 'advanced',
})
</script>

<style scoped lang="scss">
.liquid-glass-wrapper {
  overflow: hidden; /* Contains the distortion */
  box-shadow:
    0 6px 6px rgba(0, 0, 0, 0.2),
    0 0 20px rgba(0, 0, 0, 0.1);
  /* transition: all 0.4s ...; (Optional hover effects) */
}

.liquid-glass-effect {
  position: absolute;
  inset: 0;
  z-index: 0;
  backdrop-filter: blur(3px);
  filter: url(#glass-distortion);
  /* The filter applies to what's BEHIND this div. */
}

.liquid-glass-wrapper.refraction-mode .liquid-glass-effect {
  backdrop-filter: url(#glass-refraction);
  -webkit-backdrop-filter: url(#glass-refraction);
  filter: none;
}

.liquid-glass-tint {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: rgba(40, 40, 40, 0.4); /* Darker for our dark theme */
}

.liquid-glass-shine {
  position: absolute;
  inset: 0;
  z-index: 2;
  box-shadow:
    inset 2px 2px 1px 0 rgba(255, 255, 255, 0.2),
    inset -1px -1px 1px 1px rgba(255, 255, 255, 0.1);
  pointer-events: none;
}

/* Simple Mode Styles (Fallback) */
.liquid-glass-wrapper.simple-mode {
  background: rgba(20, 20, 20, 0.6);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.3);
}

/* Ghost Mode Styles */
.liquid-glass-wrapper.ghost-mode {
  background: transparent !important;
  box-shadow: none !important;
  overflow: visible !important;
}
</style>
