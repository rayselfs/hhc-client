export function calculateFitZoomPercent(
  viewportWidth: number,
  viewportHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  padding: number
): number {
  if (
    [viewportWidth, viewportHeight, canvasWidth, canvasHeight, padding].some(
      (value) => !Number.isFinite(value)
    ) ||
    viewportWidth <= 0 ||
    viewportHeight <= 0 ||
    canvasWidth <= 0 ||
    canvasHeight <= 0 ||
    padding < 0
  ) {
    return 25
  }
  const zoom = Math.floor(
    Math.min((viewportWidth - padding) / canvasWidth, (viewportHeight - padding) / canvasHeight) *
      100
  )
  if (!Number.isFinite(zoom) || zoom <= 0) return 25
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
