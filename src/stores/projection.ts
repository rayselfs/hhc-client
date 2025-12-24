import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ViewType, MessageType, type AppMessage } from '@/types/common'

export const useProjectionStore = defineStore('projection', () => {
  const isShowingDefault = ref(true)
  const currentView = ref<ViewType>(ViewType.TIMER)

  // 方法
  const setShowingDefault = (showing: boolean) => {
    isShowingDefault.value = showing
  }

  const setCurrentView = (view: ViewType) => {
    currentView.value = view
  }

  const toggleProjectionContent = () => {
    isShowingDefault.value = !isShowingDefault.value
  }

  /**
   * 處理投影消息
   */
  const handleMessage = (message: AppMessage): boolean => {
    switch (message.type) {
      case MessageType.VIEW_CHANGE:
        if ('view' in message.data) {
          setCurrentView(message.data.view as ViewType)
          setShowingDefault(false)
          return true
        }
        break
      case MessageType.PROJECTION_TOGGLE_CONTENT:
        if ('showDefault' in message.data) {
          setShowingDefault(!!message.data.showDefault)
          return true
        }
        break
      case MessageType.LOCALE_UPDATE:
        if ('locale' in message.data) {
          try {
            const { locale } = useI18n()
            locale.value = message.data.locale
            return true
          } catch (e) {
            console.warn('Failed to set locale in store', e)
          }
        }
        break
    }
    return false
  }

  return {
    // States
    isShowingDefault,
    currentView,

    // Methods
    setShowingDefault,
    setCurrentView,
    toggleProjectionContent,
    handleMessage,
  }
})
