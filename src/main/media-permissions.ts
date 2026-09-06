import type { Session, WebContents } from 'electron'

export function isTrustedMediaFrame(
  requestUrl: string | undefined,
  mainUrl: string,
  isMainFrame: boolean
): boolean {
  if (!isMainFrame || !requestUrl) return false
  try {
    const request = new URL(requestUrl)
    const main = new URL(mainUrl)
    if (!['file:', 'http:', 'https:'].includes(main.protocol)) return false
    request.hash = ''
    main.hash = ''
    return request.href === main.href
  } catch {
    return false
  }
}

export function registerMediaPermissions(
  session: Session,
  getMainContents: () => WebContents | undefined
): void {
  session.setPermissionCheckHandler((contents, permission, _origin, details) => {
    // Preserve Electron's existing behavior for unrelated permissions.
    if (permission !== 'media') return true
    const main = getMainContents()
    return (
      !!main &&
      contents === main &&
      isTrustedMediaFrame(details.requestingUrl, main.getURL(), details.isMainFrame)
    )
  })
  session.setPermissionRequestHandler((contents, permission, callback, details) => {
    if (permission !== 'media') return callback(true)
    const main = getMainContents()
    callback(
      !!main &&
        contents === main &&
        isTrustedMediaFrame(details.requestingUrl, main.getURL(), details.isMainFrame) &&
        'mediaTypes' in details &&
        !!details.mediaTypes &&
        details.mediaTypes.length > 0 &&
        details.mediaTypes.every((type) => type === 'video' || type === 'audio')
    )
  })
}
