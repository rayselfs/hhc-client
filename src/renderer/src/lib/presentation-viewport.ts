export function calculateFitZoomPercent(
  viewportWidth: number,
  viewportHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  padding: number
): number {
  const zoom = Math.floor(
    Math.min((viewportWidth - padding) / canvasWidth, (viewportHeight - padding) / canvasHeight) *
      100
  )
  return Math.max(25, Math.min(200, zoom))
}

export function calculateAnchoredScroll(
  currentOffset: number,
  anchor: number,
  previousZoom: number,
  nextZoom: number
): number {
  return Math.max(0, (currentOffset + anchor) * (nextZoom / previousZoom) - anchor)
}
