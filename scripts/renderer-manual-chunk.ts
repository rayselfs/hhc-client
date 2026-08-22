export function rendererManualChunk(id: string): string | undefined {
  const normalizedId = id.replaceAll('\\', '/')

  if (
    normalizedId.includes('/node_modules/react/') ||
    normalizedId.includes('/node_modules/react-dom/')
  ) {
    return 'react-vendor'
  }
  if (
    normalizedId.includes('/node_modules/@heroui/') ||
    normalizedId.includes('/node_modules/react-aria') ||
    normalizedId.includes('/node_modules/@react-aria/') ||
    normalizedId.includes('/node_modules/@react-stately/')
  ) {
    return 'ui-vendor'
  }
  if (normalizedId.includes('/node_modules/@phosphor-icons/')) {
    return 'icons'
  }
  return undefined
}
