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
import { useLiquidGlassFilters } from '../composables/useLiquidGlassFilters'

// Ensure SVG filters are injected (fallback if plugin not installed)
useLiquidGlassFilters()

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
@use '../styles' as liquid;

.liquid-glass-wrapper {
  overflow: hidden; /* Contains the distortion */
  box-shadow:
    0 6px 6px rgba(var(--hhc-glass-shadow-color), 0.2),
    0 0 20px rgba(var(--hhc-glass-shadow-color), 0.1);
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
  @include liquid.liquid-glass-tint-dark(0.4);
}

.liquid-glass-shine {
  position: absolute;
  inset: 0;
  z-index: 2;
  box-shadow:
    inset 2px 2px 1px 0 rgba(var(--hhc-glass-shine-top), 0.2),
    inset -1px -1px 1px 1px rgba(var(--hhc-glass-shine-top), 0.1);
  pointer-events: none;
}

/* Simple Mode Styles (Fallback) */
.liquid-glass-wrapper.simple-mode {
  background: rgba(var(--hhc-glass-simple-bg), var(--hhc-glass-simple-bg-opacity));
  @include liquid.liquid-glass-backdrop(var(--hhc-blur-xl), 180%);
  @include liquid.liquid-glass-border;
  box-shadow: 0 4px 24px -1px rgba(var(--hhc-glass-shadow-color), 0.3);
}

/* Ghost Mode Styles */
.liquid-glass-wrapper.ghost-mode {
  /* Override: Force transparent background for ghost mode to allow underlying content */
  background: transparent !important;
  /* Override: Remove box-shadow when ghost mode is enabled */
  box-shadow: none !important;
  /* Override: Allow overflow in ghost mode for special layout needs */
  overflow: visible !important;
}
</style>
