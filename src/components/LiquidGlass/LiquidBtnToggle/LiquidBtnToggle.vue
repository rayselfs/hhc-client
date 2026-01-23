<template>
  <LiquidContainer
    :mode="containerMode"
    class="liquid-btn-toggle"
    padding="pa-1"
    :rounded="rounded"
  >
    <div class="toggle-track position-relative d-flex align-center" ref="trackRef">
      <!-- The Sliding Pill (Background) -->
      <div
        class="selection-pill position-absolute"
        :class="{ animating: isAnimating }"
        :style="pillStyle"
      ></div>

      <!-- The Items (Foreground) -->
      <button
        v-for="item in items"
        :key="item.value"
        ref="itemRefs"
        class="toggle-item d-flex align-center justify-center rounded-pill"
        :class="{
          active: modelValue === item.value,
          'density-compact': density === 'compact',
        }"
        @click="select(item.value)"
        :title="item.title"
        type="button"
      >
        <v-icon v-if="item.icon" :size="computedSizes.icon">{{ item.icon }}</v-icon>
        <span
          v-if="item.label"
          class="ml-1 text-button"
          :style="{ lineHeight: 1, fontSize: computedSizes.text }"
          >{{ item.label }}</span
        >
      </button>
    </div>
  </LiquidContainer>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'

interface Item {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any
  icon?: string
  label?: string
  title?: string
}

type SizePreset = 'x-small' | 'small' | 'large' | 'x-large'

interface Props {
  /** 當前選中值 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelValue: any
  /** 選項列表 */
  items: Item[]
  /** 是否必須選擇一個值 */
  mandatory?: boolean
  /** 密度: 'default' 正常間距, 'compact' 緊湊 */
  density?: 'default' | 'compact'
  /** 玻璃效果模式 */
  mode?: 'advanced' | 'simple' | 'refraction'
  /** 圓角樣式 */
  rounded?: string
  /** 是否透明背景 */
  ghost?: boolean
  /**
   * 元件大小
   * - 預設值: 'x-small' | 'small' | 'large' | 'x-large'
   * - 數字: icon 像素大小，文字會自動縮放為 65%
   */
  size?: SizePreset | number
  /** 覆蓋 icon 大小 */
  iconSize?: string | number
  /** 覆蓋文字大小 */
  fontSize?: string
}

const props = withDefaults(defineProps<Props>(), {
  mandatory: false,
  density: 'default',
  mode: 'advanced',
  rounded: 'rounded-pill',
  ghost: false,
})

const emit = defineEmits<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (e: 'update:modelValue', value: any): void
}>()

const trackRef = ref<HTMLElement | null>(null)
const itemRefs = ref<HTMLElement[]>([])
const pillStyle = ref({
  left: '0px',
  width: '0px',
  height: '0px',
  opacity: 0,
  transformOrigin: 'center',
})
const isAnimating = ref(false)

const SIZE_MAP = {
  'x-small': { icon: 16, text: '0.625rem' },
  small: { icon: 20, text: '0.75rem' },
  large: { icon: 28, text: '1.25rem' },
  'x-large': { icon: 32, text: '1.5rem' },
}

const computedSizes = computed(() => {
  // Default sizes (when no size prop)
  let baseIcon = 24
  let baseText = '1rem'

  // Density override for default
  if (props.density === 'compact' && !props.size) {
    baseIcon = 18
  }

  // Size prop takes precedence
  if (props.size) {
    if (typeof props.size === 'string' && props.size in SIZE_MAP) {
      const map = SIZE_MAP[props.size as keyof typeof SIZE_MAP]
      baseIcon = map.icon
      baseText = map.text
    } else if (typeof props.size === 'number') {
      baseIcon = props.size
      baseText = `${Math.round(props.size * 0.65)}px`
    }
  }

  // Individual overrides take highest precedence
  const result = {
    icon: props.iconSize ?? baseIcon,
    text: props.fontSize ?? baseText,
  }
  return result
})

const containerMode = computed(() => (props.ghost ? 'ghost' : props.mode))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const select = (value: any) => {
  if (props.mandatory && value === props.modelValue) return
  emit('update:modelValue', value)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const updatePillPosition = (oldValue?: any) => {
  if (!trackRef.value || itemRefs.value.length === 0) return

  const newIndex = props.items.findIndex((item) => item.value === props.modelValue)
  if (newIndex === -1) {
    pillStyle.value = { ...pillStyle.value, opacity: 0 }
    return
  }

  // Determine direction for jelly effect
  const oldIndex = props.items.findIndex((item) => item.value === oldValue)
  if (oldValue !== undefined && oldIndex !== -1) {
    // If moving right (new > old), anchor left. If moving left, anchor right.
    const direction = newIndex > oldIndex ? 'left' : 'right'
    pillStyle.value.transformOrigin = direction
    isAnimating.value = true
    setTimeout(() => {
      isAnimating.value = false
    }, 400) // Match animation duration
  }

  const el = itemRefs.value[newIndex]
  if (el) {
    pillStyle.value = {
      ...pillStyle.value,
      left: `${el.offsetLeft}px`,
      width: `${el.offsetWidth}px`,
      height: `${el.offsetHeight}px`,
      opacity: 1,
    }
  }
}

watch(
  () => props.modelValue,
  (newVal, oldVal) => {
    nextTick(() => updatePillPosition(oldVal))
  },
)

// Handle window resize or layout shifts
onMounted(() => {
  // Initial update
  nextTick(updatePillPosition)

  // Observe resize to update pill
  const observer = new ResizeObserver(() => {
    updatePillPosition()
  })
  if (trackRef.value) {
    observer.observe(trackRef.value)
  }
})
</script>

<style scoped lang="scss">
@use '../styles' as liquid;

.liquid-btn-toggle {
  display: inline-flex;
  --glass-pill-bg: rgba(255, 255, 255, 0.15);
}

.toggle-track {
  z-index: 1;
}

.toggle-item {
  position: relative;
  z-index: 2; /* Above pill */
  background: transparent;
  border: none;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s ease;
  padding: 6px 16px;
  min-width: 36px;
  color: white; /* Default text color for glass */

  &.density-compact {
    padding: 4px 12px;
  }

  &.active {
    opacity: 1;
  }

  &:hover:not(.active) {
    opacity: 0.8;
  }
}

.selection-pill {
  z-index: 1;
  background-color: var(--glass-pill-bg);
  border-radius: 9999px; /* Pill shape */
  transition:
    left 0.4s cubic-bezier(1, 0, 0.4, 1),
    width 0.4s cubic-bezier(1, 0, 0.4, 1),
    height 0.4s cubic-bezier(1, 0, 0.4, 1);

  @include liquid.liquid-glass-pill-shadow;
  @include liquid.liquid-glass-backdrop(4px, 100%);

  &.animating {
    @include liquid.liquid-jelly-animation;
  }
}
</style>
