import { useSentry } from './useSentry'

export const useElectronFiles = () => {
  const { reportError } = useSentry()

  const isElectron = (): boolean => {
    return typeof window !== 'undefined' && !!window.electronAPI
  }

  const getFilePath = (file: File): string => {
    if (isElectron()) {
      return window.electronAPI.getFilePath(file)
    }
    return ''
  }

  const saveFile = async (
    sourcePath: string,
  ): Promise<{ filePath: string; thumbnailData?: Uint8Array }> => {
    if (isElectron()) {
      try {
        return await window.electronAPI.saveFile(sourcePath)
      } catch (error) {
        reportError(error, {
          operation: 'save-file',
          component: 'useElectronFiles',
        })
        throw error
      }
    }
    throw new Error('Not in Electron environment')
  }

  return {
    getFilePath,
    saveFile,
  }
}
