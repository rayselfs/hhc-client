import { ref, onMounted, onBeforeUnmount } from 'vue'
import { throttle } from '@/utils/performanceUtils'

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

  const leftCardHeight = ref(600)
  const rightTopCardHeight = ref(360)
  const rightBottomCardHeight = ref(240)

  const calculateHeights = () => {
    const viewportHeight = window.innerHeight - headerOffset
    leftCardHeight.value = viewportHeight < minHeight ? minHeight : viewportHeight

    const rightCardTotalHeight = leftCardHeight.value - gap
    rightTopCardHeight.value = Math.floor(rightCardTotalHeight * topCardRatio)
    rightBottomCardHeight.value = Math.floor(rightCardTotalHeight * (1 - topCardRatio))
  }

  const handleResize = throttle(calculateHeights, 100)

  onMounted(() => {
    calculateHeights()
    window.addEventListener('resize', handleResize)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize)
  })

  return {
    leftCardHeight,
    rightTopCardHeight,
    rightBottomCardHeight,
    calculateHeights,
  }
}
