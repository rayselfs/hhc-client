import React, { createContext, useContext } from 'react'

type PreviewCacheContextValue = {
  pdfPageThumbs: Record<string, string[]>
}

const PreviewCacheContext = createContext<PreviewCacheContextValue>({ pdfPageThumbs: {} })

export function PreviewCacheProvider({
  pdfPageThumbs,
  children
}: PreviewCacheContextValue & { children: React.ReactNode }): React.JSX.Element {
  return (
    <PreviewCacheContext.Provider value={{ pdfPageThumbs }}>
      {children}
    </PreviewCacheContext.Provider>
  )
}

export function usePreviewCacheContext(): PreviewCacheContextValue {
  return useContext(PreviewCacheContext)
}
