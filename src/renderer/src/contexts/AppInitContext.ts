import { createContext, useContext } from 'react'

export const AppInitContext = createContext(false)

export const useAppInit = (): boolean => useContext(AppInitContext)
