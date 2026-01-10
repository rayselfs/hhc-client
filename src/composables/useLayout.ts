import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { throttle } from '@/utils/performanceUtils'
import { useDisplay } from 'vuetify'

/**
 * Responsive window size composable
 * Provides unified resize listener to avoid duplicate listeners in multiple components
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
    topCardRatio = 0.6, // Default 60% top, 40% bottom
  } = options

  const { height } = useWindowSize(100)
  const { mdAndUp } = useDisplay()

  const leftCardHeight = ref(600)
  const rightTopCardHeight = ref(360)
  const rightBottomCardHeight = ref(240)
  const mediaSpaceHeight = ref(600)

  const calculateHeights = () => {
    const viewportHeight = height.value - headerOffset
    // If smaller than lg (Mobile/Tablet), scale height to 80% to show content below
    const responsiveScale = mdAndUp.value ? 1 : 0.8
    const targetHeight = viewportHeight * responsiveScale

    leftCardHeight.value = targetHeight < minHeight ? minHeight : targetHeight

    const rightCardTotalHeight = leftCardHeight.value - gap
    rightTopCardHeight.value = Math.floor(rightCardTotalHeight * topCardRatio)
    rightBottomCardHeight.value = Math.floor(rightCardTotalHeight * (1 - topCardRatio))

    mediaSpaceHeight.value = viewportHeight - gap - 20
  }

  onMounted(() => {
    calculateHeights()
  })

  // Listen for changes in height and mdAndUp to recalculate heights
  watch([() => height.value, mdAndUp], () => {
    calculateHeights()
  })

  return {
    leftCardHeight,
    rightTopCardHeight,
    rightBottomCardHeight,
    mediaSpaceHeight,
    calculateHeights,
  }
}
