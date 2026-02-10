<template>
  <div
    class="liquid-search-bar"
    :class="{ 'liquid-search-bar--disabled': disabled }"
    :style="cssVars"
    role="search"
  >
    <!-- 單一容器，用 clip-path 控制可見範圍 -->
    <div
      ref="barRef"
      class="liquid-search-bar__bar"
      :class="{
        'liquid-search-bar__bar--expanded': isExpanded,
        'liquid-search-bar__bar--collapsing': isCollapsing,
      }"
      :aria-expanded="isExpanded"
      @animationend="onAnimationEnd"
    >
      <!-- Glass layers -->
      <div class="liquid-search-bar__glass-effect rounded-pill"></div>
      <div class="liquid-search-bar__glass-tint rounded-pill"></div>
      <div class="liquid-search-bar__glass-shine rounded-pill"></div>

      <!-- 單一 icon，用 transform 移動 -->
      <LiquidIcon
        :icon="icon"
        class="liquid-search-bar__icon"
        :class="{ 'liquid-search-bar__icon--expanded': isExpanded }"
        :size="iconSize"
        :aria-label="isExpanded ? undefined : ariaLabel || 'Expand search'"
        role="button"
        :tabindex="isExpanded ? -1 : 0"
        @click="handleIconClick"
        @keydown.enter="handleIconClick"
        @keydown.space.prevent="handleIconClick"
      />

      <!-- Input，展開後顯示 -->
      <input
        v-show="isExpanded"
        ref="inputRef"
        v-model="searchText"
        type="text"
        class="liquid-search-bar__input"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-label="ariaLabel || placeholder"
        @blur="handleBlur"
        @keydown.esc="handleCollapse"
        @keydown.enter="handleSearch"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useLiquidGlassFilters } from '../composables/useLiquidGlassFilters'
import LiquidIcon from '../LiquidIcon/LiquidIcon.vue'
import { getSizeConfig, isSizeKey, type SizeKey } from '../constants'

useLiquidGlassFilters()

type SizePreset = 'x-small' | 'small' | 'large' | 'x-large'
type Variant = 'glass' | 'tinted'

interface Props {
  modelValue?: string
  placeholder?: string
  expandedWidth?: string | number
  disabled?: boolean
  icon?: string
  size?: SizePreset | number
  variant?: Variant
  color?: string
  /** ARIA 標籤 */
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Search',
  expandedWidth: 300,
  disabled: false,
  icon: 'mdi-magnify',
  variant: 'glass',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'search', value: string): void
  (e: 'expand'): void
  (e: 'collapse'): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const barRef = ref<HTMLElement | null>(null)
const isExpanded = ref(false)
const isCollapsing = ref(false)
const searchText = ref(props.modelValue)

const computedSizes = computed(() => {
  // Get config from shared constants
  const sizeKey: SizeKey | number =
    props.size && isSizeKey(props.size) ? props.size : (props.size ?? 'default')
  const config = getSizeConfig(sizeKey)

  // Handle numeric size
  if (typeof props.size === 'number') {
    return {
      icon: props.size,
      height: Math.round(props.size * 1.8),
    }
  }

  return {
    icon: config.icon,
    height: config.height,
  }
})

const iconSize = computed(() => computedSizes.value.icon)

const computedExpandedWidth = computed(() => {
  if (typeof props.expandedWidth === 'number') {
    return props.expandedWidth
  }
  return parseInt(props.expandedWidth, 10) || 300
})

const cssVars = computed(() => ({
  '--expanded-width': `${computedExpandedWidth.value}px`,
  '--collapsed-width': `${computedSizes.value.height}px`,
  '--height': `${computedSizes.value.height}px`,
  '--icon-size': `${iconSize.value}px`,
}))

const handleIconClick = () => {
  if (props.disabled) return

  if (!isExpanded.value) {
    handleExpand()
  }
}

const handleExpand = () => {
  if (props.disabled || isExpanded.value) return
  isExpanded.value = true
  isCollapsing.value = false
  emit('expand')
  nextTick(() => {
    inputRef.value?.focus()
  })
}

const handleCollapse = () => {
  if (!isExpanded.value || isCollapsing.value) return
  isCollapsing.value = true
  searchText.value = ''
  emit('update:modelValue', '')
  emit('collapse')
}

const onAnimationEnd = () => {
  // 收合動畫結束時重置狀態
  if (isCollapsing.value) {
    isExpanded.value = false
    isCollapsing.value = false
  }
}

const handleBlur = () => {
  handleCollapse()
}

const handleSearch = (event: KeyboardEvent) => {
  if (event.isComposing) return
  const trimmed = searchText.value.trim()
  if (trimmed) {
    emit('search', trimmed)
    emit('update:modelValue', trimmed)
  }
  handleCollapse()
}
</script>

<style scoped lang="scss">
@use '../styles' as liquid;

.liquid-search-bar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  height: var(--height, 40px);
  min-width: var(--collapsed-width, 40px);

  &--disabled {
    opacity: 0.4;
    pointer-events: none;
  }
}

.liquid-search-bar__bar {
  position: relative;
  display: flex;
  align-items: center;
  width: var(--collapsed-width, 40px);
  height: var(--height, 40px);
  border-radius: 9999px;
  cursor: pointer;

  &--expanded {
    width: var(--expanded-width, 300px);
    cursor: default;
    animation: clip-expand 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  &--collapsing {
    animation: clip-collapse 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
}

@keyframes clip-expand {
  from {
    width: var(--collapsed-width, 40px);
    clip-path: inset(0 0 0 0);
  }
  to {
    width: var(--expanded-width, 300px);
    clip-path: inset(0 0 0 0);
  }
}

@keyframes clip-collapse {
  from {
    width: var(--expanded-width, 300px);
    clip-path: inset(0 0 0 0);
  }
  to {
    width: var(--collapsed-width, 40px);
    clip-path: inset(0 0 0 0);
  }
}

// Glass layers
.liquid-search-bar__glass-effect {
  position: absolute;
  inset: 0;
  z-index: 0;
  @include liquid.liquid-glass-backdrop;
}

.liquid-search-bar__glass-tint {
  position: absolute;
  inset: 0;
  z-index: 1;
  @include liquid.liquid-glass-tint;
}

.liquid-search-bar__glass-shine {
  position: absolute;
  inset: 0;
  z-index: 2;
  @include liquid.liquid-glass-pill-shadow;
  pointer-events: none;
}

// Icon - 用 left 定位，展開時移動到左側
.liquid-search-bar__icon {
  position: absolute;
  z-index: 3;
  // 置中：left 50% of collapsed width, 然後 translateX -50% 自身寬度
  left: calc(var(--collapsed-width, 40px) / 2);
  top: 50%;
  transform: translate(-50%, -50%);
  color: rgba(var(--hhc-glass-text, 0, 0, 0), 1);
  cursor: pointer;
  // 確保 icon 沒有額外間距
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    left var(--hhc-transition-normal) var(--hhc-transition-easing),
    transform var(--hhc-transition-normal, 300ms)
      var(--hhc-transition-easing, cubic-bezier(0.4, 0, 0.2, 1));

  &--expanded {
    // 展開後：icon 左邊緣在 16px 處
    left: calc(16px + var(--icon-size, 16px) / 2);
    transform: translate(-50%, -50%);
    cursor: default;
    color: rgba(var(--hhc-glass-text, 0, 0, 0), 0.7);
  }
}

// Input
.liquid-search-bar__input {
  position: absolute;
  z-index: 3;
  left: calc(16px + var(--icon-size, 16px) + 8px); // padding + icon + gap
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  outline: none;
  color: rgba(var(--hhc-glass-text, 0, 0, 0), var(--hhc-glass-text-opacity, 1));
  font-size: 0.875rem;
  font-weight: 400;

  &::placeholder {
    color: rgba(var(--hhc-glass-text, 0, 0, 0), 0.5);
  }
}
</style>
