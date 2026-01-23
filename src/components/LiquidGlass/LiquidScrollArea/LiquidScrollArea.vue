<template>
  <div
    ref="containerRef"
    class="liquid-scroll-area"
    @wheel="handleWheel"
    @touchstart.passive="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <!-- Viewport: clips content, no native scrollbar -->
    <div ref="viewportRef" class="liquid-scroll-area__viewport">
      <!-- Content: transformed by scrollOffset + bounceOffset -->
      <div ref="contentRef" class="liquid-scroll-area__content" :style="contentStyle">
        <slot></slot>
      </div>
    </div>

    <!-- Custom Scrollbar -->
    <div
      v-show="showScrollbar && needsScrollbar"
      class="liquid-scroll-area__scrollbar"
      :class="{ 'is-visible': isScrollbarVisible, 'is-dragging': isDragging }"
      @mousedown="handleTrackClick"
    >
      <div
        class="liquid-scroll-area__thumb"
        :style="thumbStyle"
        @mousedown.stop="handleThumbMouseDown"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

interface Props {
  /** 最大彈性位移（px） */
  maxBounce?: number
  /** 彈性阻力係數（越大越難拉） */
  resistance?: number
  /** Spring 剛度（0-1，越大回彈越快） */
  stiffness?: number
  /** Spring 阻尼（0-1，越大越快停止） */
  damping?: number
  /** Momentum 摩擦力（越大越快停止） */
  momentumFriction?: number
  /** 是否顯示 scrollbar */
  showScrollbar?: boolean
  /** Scrollbar 自動隱藏延遲（ms） */
  autoHideDelay?: number
  /** Virtual Scroller 支援：外部提供總高度 */
  totalHeight?: number
}

const props = withDefaults(defineProps<Props>(), {
  maxBounce: 45,
  resistance: 2.5,
  stiffness: 0.12,
  damping: 0.8,
  momentumFriction: 0.95,
  showScrollbar: true,
  autoHideDelay: 1200,
})

const emit = defineEmits<{
  scroll: [offset: number, velocity: number]
  bounceStart: [direction: 'top' | 'bottom']
  bounceEnd: []
}>()

// Refs
const containerRef = ref<HTMLElement | null>(null)
const viewportRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)

// Scroll state
const scrollOffset = ref(0) // 目前滾動位置 (0 = top)
const bounceOffset = ref(0) // 彈性位移
const velocity = ref(0) // 滾動速度 (用於 momentum)
const isAnimating = ref(false)
const isBouncing = ref(false)
const isUserInteracting = ref(false) // 用戶正在輸入中

// Scrollbar state
const isScrollbarVisible = ref(false)
const isDragging = ref(false)
let hideScrollbarTimer: ReturnType<typeof setTimeout> | null = null
let interactionTimer: ReturnType<typeof setTimeout> | null = null

// Dimensions (updated on mount and resize)
const viewportHeight = ref(0)
const contentHeight = ref(0)

// Touch tracking
let lastTouchY = 0
let lastTouchTime = 0

// Animation
let animationFrameId: number | null = null

// Computed: 最大可滾動距離
const maxScrollOffset = computed(() => {
  return Math.max(0, contentHeight.value - viewportHeight.value)
})

// Computed: 是否需要 scrollbar
const needsScrollbar = computed(() => {
  return contentHeight.value > viewportHeight.value
})

// Computed: Content transform
const contentStyle = computed(() => {
  const totalOffset = -scrollOffset.value + bounceOffset.value
  return {
    transform: `translate3d(0, ${totalOffset}px, 0)`,
  }
})

// Computed: 是否正在進行 JS 動畫（用於停用 CSS transition）
const isJsAnimating = computed(() => isAnimating.value || isDragging.value)

// Computed: Thumb 樣式（含壓縮效果）
// 拆分成多個小 computed 以優化快取
const trackHeight = computed(() => viewportHeight.value)

const baseThumbHeight = computed(() => {
  const scrollRatio = viewportHeight.value / contentHeight.value
  return Math.max(30, trackHeight.value * scrollRatio)
})

const thumbCompression = computed(() => {
  const bounceAbs = Math.abs(bounceOffset.value)
  return 1 - (bounceAbs / props.maxBounce) * 0.4
})

const thumbHeight = computed(() => baseThumbHeight.value * thumbCompression.value)

const thumbStyle = computed(() => {
  if (!needsScrollbar.value) return {}

  const heightReduction = baseThumbHeight.value - thumbHeight.value

  // Thumb 基礎位置（根據滾動進度）
  const scrollProgress = maxScrollOffset.value > 0 ? scrollOffset.value / maxScrollOffset.value : 0
  const baseMaxThumbOffset = trackHeight.value - baseThumbHeight.value
  let thumbOffset = scrollProgress * baseMaxThumbOffset

  // Bounce 時調整位置，讓錨點固定
  if (bounceOffset.value > 0) {
    // 頂部 bounce：thumb 頂部固定 (top = 0)，從下方縮短
    // thumbOffset 保持 0，不需調整
  } else if (bounceOffset.value < 0) {
    // 底部 bounce：thumb 底部固定，從上方縮短
    // 需要增加 offset 來補償高度減少
    thumbOffset += heightReduction
  }

  // Clamp thumb position
  const maxThumbOffset = trackHeight.value - thumbHeight.value
  thumbOffset = Math.max(0, Math.min(maxThumbOffset, thumbOffset))

  return {
    height: `${thumbHeight.value}px`,
    transform: `translate3d(0, ${thumbOffset}px, 0)`,
    // JS 動畫中或拖曳中：停用 CSS transition，避免與 JS 動畫衝突
    transition: isJsAnimating.value ? 'none' : undefined,
  }
})

// 邊界檢測
const isAtTop = (): boolean => scrollOffset.value <= 0
const isAtBottom = (): boolean => scrollOffset.value >= maxScrollOffset.value

// 顯示 scrollbar
const showScrollbarTemporarily = () => {
  isScrollbarVisible.value = true
  if (hideScrollbarTimer) {
    clearTimeout(hideScrollbarTimer)
  }
  hideScrollbarTimer = setTimeout(() => {
    if (!isDragging.value) {
      isScrollbarVisible.value = false
    }
  }, props.autoHideDelay)
}

// 更新尺寸
const updateDimensions = () => {
  if (viewportRef.value && contentRef.value) {
    viewportHeight.value = viewportRef.value.clientHeight
    contentHeight.value = props.totalHeight ?? contentRef.value.scrollHeight
  }
}

// Clamp scroll offset
const clampScrollOffset = (offset: number): number => {
  return Math.max(0, Math.min(maxScrollOffset.value, offset))
}

// 統一的動畫循環：處理 momentum + bounce
const startAnimation = () => {
  if (isAnimating.value) return
  isAnimating.value = true

  const animate = () => {
    let needsContinue = false

    // === Bounce 物理 ===
    if (isBouncing.value && bounceOffset.value !== 0) {
      const bounceProgress = Math.abs(bounceOffset.value) / props.maxBounce

      if (isUserInteracting.value) {
        // 用戶還在拉：當接近極限時，用很小的力開始回拉
        // 這樣可以減少「卡住」的感覺
        if (bounceProgress > 0.3) {
          // 越接近極限，回拉力越大
          const softPullback = (bounceProgress - 0.3) * 0.25
          bounceOffset.value *= 1 - softPullback
        }
        needsContinue = true
      } else {
        // 用戶停止輸入：正常 spring 回彈
        velocity.value += -bounceOffset.value * props.stiffness
        velocity.value *= props.damping
        bounceOffset.value += velocity.value

        // 檢查是否結束
        if (Math.abs(bounceOffset.value) < 0.5 && Math.abs(velocity.value) < 0.5) {
          bounceOffset.value = 0
          velocity.value = 0
          isBouncing.value = false
          emit('bounceEnd')
        } else {
          needsContinue = true
        }
      }
    }

    // === Momentum 物理（正常滾動區域）===
    if (!isBouncing.value && !isUserInteracting.value && Math.abs(velocity.value) > 0.5) {
      const newOffset = scrollOffset.value + velocity.value

      if (newOffset < 0) {
        scrollOffset.value = 0
        startBounce('top', velocity.value)
        needsContinue = true
      } else if (newOffset > maxScrollOffset.value) {
        scrollOffset.value = maxScrollOffset.value
        startBounce('bottom', velocity.value)
        needsContinue = true
      } else {
        scrollOffset.value = newOffset
        velocity.value *= props.momentumFriction
        needsContinue = true
      }

      emit('scroll', scrollOffset.value, velocity.value)
      showScrollbarTemporarily()
    }

    // 如果用戶正在操作但還沒進入 bounce，保持動畫循環等待
    if (isUserInteracting.value && !isBouncing.value && Math.abs(velocity.value) > 0.5) {
      needsContinue = true
    }

    if (needsContinue) {
      animationFrameId = requestAnimationFrame(animate)
    } else {
      isAnimating.value = false
      animationFrameId = null
    }
  }

  animationFrameId = requestAnimationFrame(animate)
}

// 標記用戶開始輸入
const markUserInteracting = () => {
  isUserInteracting.value = true
  if (interactionTimer) {
    clearTimeout(interactionTimer)
  }
  // 用戶停止輸入 80ms 後，開始回彈
  interactionTimer = setTimeout(() => {
    isUserInteracting.value = false
  }, 80)
}

// 開始 bounce
const startBounce = (direction: 'top' | 'bottom', initialVelocity: number) => {
  isBouncing.value = true
  emit('bounceStart', direction)

  // 保留更多動量進入 bounce
  velocity.value = initialVelocity * 0.5
}

// 應用 rubber band 效果
const applyBounce = (delta: number) => {
  const maxAbs = props.maxBounce
  const currentOffset = bounceOffset.value
  const currentSign = currentOffset >= 0 ? 1 : -1
  const currentBounded = Math.abs(currentOffset)

  // Inverse asymptotic formula
  let currentRaw = 0
  if (currentBounded > 0 && currentBounded < maxAbs) {
    currentRaw = (currentBounded * maxAbs) / (maxAbs - currentBounded)
  }
  currentRaw *= currentSign

  const newRaw = currentRaw + delta / props.resistance
  const newSign = newRaw >= 0 ? 1 : -1
  const newRawAbs = Math.abs(newRaw)
  const newBounded = (maxAbs * newRawAbs) / (newRawAbs + maxAbs)

  bounceOffset.value = newBounded * newSign
}

// Wheel 處理
const handleWheel = (event: WheelEvent) => {
  if (!viewportRef.value) return

  event.preventDefault()
  showScrollbarTemporarily()
  markUserInteracting()

  const delta = event.deltaY

  const atTop = isAtTop()
  const atBottom = isAtBottom()
  const scrollingUp = delta < 0
  const scrollingDown = delta > 0

  // 判斷是否應該 bounce
  const shouldBounce = (atTop && scrollingUp) || (atBottom && scrollingDown)
  const inBounceState = bounceOffset.value !== 0

  if (shouldBounce || inBounceState) {
    // Bounce 模式
    if (!isBouncing.value && shouldBounce) {
      isBouncing.value = true
      velocity.value = 0 // 重置速度
      emit('bounceStart', atTop ? 'top' : 'bottom')
    }

    if (shouldBounce) {
      // 繼續拉伸 bounce
      applyBounce(-delta * 0.5)
    } else if (inBounceState) {
      // 在 bounce 狀態往回滾：先消耗 bounceOffset，歸零後才正常滾動
      const bouncingAtTop = bounceOffset.value > 0
      const bouncingAtBottom = bounceOffset.value < 0
      const scrollingBack = (bouncingAtTop && scrollingDown) || (bouncingAtBottom && scrollingUp)

      if (scrollingBack) {
        // 用 delta 消耗 bounceOffset
        const newBounce = bounceOffset.value + (bouncingAtTop ? -delta * 0.8 : -delta * 0.8)

        // 檢查是否已經消耗完畢（過零點）
        if ((bouncingAtTop && newBounce <= 0) || (bouncingAtBottom && newBounce >= 0)) {
          // Bounce 結束，多餘的 delta 轉為正常滾動
          bounceOffset.value = 0
          isBouncing.value = false
          emit('bounceEnd')

          // 計算剩餘 delta 並滾動
          const consumed = bouncingAtTop ? bounceOffset.value : -bounceOffset.value
          const remainingDelta = delta + consumed / 0.8
          if (Math.abs(remainingDelta) > 1) {
            scrollOffset.value = clampScrollOffset(scrollOffset.value + remainingDelta)
            velocity.value = remainingDelta * 0.5
            emit('scroll', scrollOffset.value, velocity.value)
          }
        } else {
          bounceOffset.value = newBounce
        }
      }
    }

    // 確保動畫循環在跑
    if (!isAnimating.value) {
      startAnimation()
    }
  } else {
    // 正常滾動
    const newOffset = clampScrollOffset(scrollOffset.value + delta)
    scrollOffset.value = newOffset

    // 計算速度用於 momentum
    velocity.value = delta * 0.5

    emit('scroll', scrollOffset.value, velocity.value)
  }
}

// Touch 處理
const handleTouchStart = (event: TouchEvent) => {
  const touch = event.touches[0]
  if (!touch) return

  // 停止動畫
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
    isAnimating.value = false
  }

  lastTouchY = touch.clientY
  lastTouchTime = performance.now()
  velocity.value = 0
  isBouncing.value = false
  isUserInteracting.value = true

  showScrollbarTemporarily()
}

const handleTouchMove = (event: TouchEvent) => {
  const touch = event.touches[0]
  if (!touch) return

  const currentY = touch.clientY
  const deltaY = currentY - lastTouchY
  const currentTime = performance.now()
  const deltaTime = currentTime - lastTouchTime

  const atTop = isAtTop()
  const atBottom = isAtBottom()
  const movingDown = deltaY > 0 // 手指往下 = 想看上面內容
  const movingUp = deltaY < 0

  const shouldBounce = (atTop && movingDown) || (atBottom && movingUp)
  const inBounceState = bounceOffset.value !== 0

  if (shouldBounce || inBounceState) {
    event.preventDefault()

    if (!isBouncing.value && shouldBounce) {
      isBouncing.value = true
      emit('bounceStart', atTop ? 'top' : 'bottom')
    }

    applyBounce(deltaY)
  } else {
    // 正常滾動
    const newOffset = clampScrollOffset(scrollOffset.value - deltaY)
    scrollOffset.value = newOffset

    // 計算速度用於 momentum (touch 結束後用)
    if (deltaTime > 0) {
      velocity.value = (-deltaY / deltaTime) * 16
    }

    emit('scroll', scrollOffset.value, velocity.value)
  }

  lastTouchY = currentY
  lastTouchTime = currentTime
  showScrollbarTemporarily()
}

const handleTouchEnd = () => {
  isUserInteracting.value = false
  // 開始 momentum 或 bounce 回彈動畫
  if (bounceOffset.value !== 0 || Math.abs(velocity.value) > 1) {
    startAnimation()
  }
}

// Scrollbar 拖曳
let dragStartY = 0
let dragStartScrollOffset = 0

const handleThumbMouseDown = (event: MouseEvent) => {
  event.preventDefault()
  isDragging.value = true
  dragStartY = event.clientY
  dragStartScrollOffset = scrollOffset.value

  document.addEventListener('mousemove', handleThumbMouseMove)
  document.addEventListener('mouseup', handleThumbMouseUp)
}

const handleThumbMouseMove = (event: MouseEvent) => {
  if (!isDragging.value) return

  const deltaY = event.clientY - dragStartY
  const scrollableTrack = trackHeight.value - baseThumbHeight.value

  // 計算滾動比例
  const scrollDelta = (deltaY / scrollableTrack) * maxScrollOffset.value
  scrollOffset.value = clampScrollOffset(dragStartScrollOffset + scrollDelta)

  emit('scroll', scrollOffset.value, 0)
}

const handleThumbMouseUp = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleThumbMouseMove)
  document.removeEventListener('mouseup', handleThumbMouseUp)

  // 延遲隱藏
  showScrollbarTemporarily()
}

// 點擊 track 跳轉
const handleTrackClick = (event: MouseEvent) => {
  if (event.target !== event.currentTarget) return

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const clickY = event.clientY - rect.top
  const clickRatio = clickY / viewportHeight.value

  const targetOffset = clickRatio * maxScrollOffset.value
  scrollOffset.value = clampScrollOffset(targetOffset)

  emit('scroll', scrollOffset.value, 0)
  showScrollbarTemporarily()
}

// Public API
const scrollTo = (offset: number, animated = true) => {
  if (animated) {
    // TODO: 實作平滑滾動
    scrollOffset.value = clampScrollOffset(offset)
  } else {
    scrollOffset.value = clampScrollOffset(offset)
  }
  emit('scroll', scrollOffset.value, 0)
  showScrollbarTemporarily()
}

const scrollBy = (delta: number, animated = true) => {
  scrollTo(scrollOffset.value + delta, animated)
}

const getScrollOffset = () => scrollOffset.value

defineExpose({
  scrollTo,
  scrollBy,
  getScrollOffset,
  updateDimensions,
})

// Lifecycle
onMounted(() => {
  updateDimensions()

  // ResizeObserver 監聯尺寸變化
  const resizeObserver = new ResizeObserver(() => {
    updateDimensions()
  })

  if (viewportRef.value) resizeObserver.observe(viewportRef.value)
  if (contentRef.value) resizeObserver.observe(contentRef.value)

  onUnmounted(() => {
    resizeObserver.disconnect()
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
    }
    if (hideScrollbarTimer) {
      clearTimeout(hideScrollbarTimer)
    }
    if (interactionTimer) {
      clearTimeout(interactionTimer)
    }
    // 清理可能殘留的 document event listeners
    document.removeEventListener('mousemove', handleThumbMouseMove)
    document.removeEventListener('mouseup', handleThumbMouseUp)
  })
})

// Watch content changes
watch(
  () => props.totalHeight,
  () => updateDimensions(),
)
</script>

<style scoped lang="scss">
.liquid-scroll-area {
  position: relative;
  overflow: hidden;
  // 支援 height 或 max-height
  // 如果設了 max-height，需要配合 display: flex 讓 viewport 能正確限制高度
  display: flex;
  flex-direction: column;
}

.liquid-scroll-area__viewport {
  position: relative;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0; // 關鍵：允許 flex item 縮小
  overflow: hidden;
}

.liquid-scroll-area__content {
  will-change: transform;
}

// Custom Scrollbar
.liquid-scroll-area__scrollbar {
  position: absolute;
  top: 2px;
  right: 2px;
  bottom: 2px;
  width: 8px;
  border-radius: 4px;
  opacity: 0;
  transition:
    opacity 0.2s ease-out,
    width 0.15s ease-out;
  cursor: pointer;

  &.is-visible {
    opacity: 1;
  }

  &.is-dragging {
    opacity: 1;
  }

  // Hover 時變寬
  &:hover {
    width: 10px;
  }
}

.liquid-scroll-area__thumb {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  min-height: 30px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 4px;
  will-change: transform, height;
  // height/transform transition 由 JS 透過 inline style 控制
  // JS 動畫時設為 none，靜止時恢復 CSS transition
  transition:
    background 0.15s ease-out,
    height 0.1s ease-out,
    transform 0.1s ease-out;
  cursor: grab;

  &:hover {
    background: rgba(255, 255, 255, 0.4);
  }

  &:active {
    background: rgba(255, 255, 255, 0.55);
    cursor: grabbing;
  }

  .is-dragging & {
    background: rgba(255, 255, 255, 0.55);
    cursor: grabbing;
  }
}
</style>
