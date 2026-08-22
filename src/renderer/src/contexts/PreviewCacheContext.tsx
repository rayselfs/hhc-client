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

// This hook intentionally shares the provider's private context.
// eslint-disable-next-line react-refresh/only-export-components
export function usePreviewCacheContext(): PreviewCacheContextValue {
  return useContext(PreviewCacheContext)
}
