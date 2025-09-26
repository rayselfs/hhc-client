import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useProjectionStore = defineStore('projection', () => {
  const isShowingDefault = ref(true) // true = 顯示預設內容（投影關閉狀態），false = 顯示實際內容（投影開啟狀態）
  const currentView = ref('bible') // 預設視圖

  // 方法
  const setShowingDefault = (showing: boolean) => {
    isShowingDefault.value = showing
  }

  const setCurrentView = (view: string) => {
    currentView.value = view
  }

  const toggleProjectionContent = () => {
    isShowingDefault.value = !isShowingDefault.value
  }

  return {
    // 狀態
    isShowingDefault,
    currentView,

    // 方法
    setShowingDefault,
    setCurrentView,
    toggleProjectionContent,
  }
})
