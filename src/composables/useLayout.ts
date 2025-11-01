import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { throttle } from '@/utils/performanceUtils'

/**
 * 響應式視窗尺寸 composable
 * 提供統一的 resize 監聽器，避免多個組件重複監聽
 */
export const useWindowSize = (throttleDelay = 100) => {
  const windowSize = ref({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
  })

  const handleResize = throttle(() => {
    windowSize.value = {
      width: window.innerWidth,
      height: window.innerHeight,
    }
  }, throttleDelay)

  onMounted(() => {
    window.addEventListener('resize', handleResize)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize)
  })

  return {
    windowSize: computed(() => windowSize.value),
    width: computed(() => windowSize.value.width),
    height: computed(() => windowSize.value.height),
  }
}

interface CardLayoutOptions {
  minHeight?: number
  headerOffset?: number
  gap?: number
  topCardRatio?: number
}

export const useCardLayout = (options: CardLayoutOptions = {}) => {
  const {
    minHeight = 600,
    headerOffset = 96,
    gap = 16,
    topCardRatio = 0.6, // 預設 60% 上，40% 下
  } = options

  const { height } = useWindowSize(100)

  const leftCardHeight = ref(600)
  const rightTopCardHeight = ref(360)
  const rightBottomCardHeight = ref(240)

  const calculateHeights = () => {
    const viewportHeight = height.value - headerOffset
    leftCardHeight.value = viewportHeight < minHeight ? minHeight : viewportHeight

    const rightCardTotalHeight = leftCardHeight.value - gap
    rightTopCardHeight.value = Math.floor(rightCardTotalHeight * topCardRatio)
    rightBottomCardHeight.value = Math.floor(rightCardTotalHeight * (1 - topCardRatio))
  }

  onMounted(() => {
    calculateHeights()
  })

  // 監聽 height 變化來重新計算高度
  watch(
    () => height.value,
    () => {
      calculateHeights()
    },
  )

  return {
    leftCardHeight,
    rightTopCardHeight,
    rightBottomCardHeight,
    calculateHeights,
  }
}
