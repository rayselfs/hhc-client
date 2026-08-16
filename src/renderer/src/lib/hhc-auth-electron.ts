import type { HhcAuthAdapter, HhcSession } from '@shared/hhc-auth'

export class ElectronHhcAuthAdapter implements HhcAuthAdapter {
  private readonly cleanups = new Set<() => void>()

  getSession(): Promise<HhcSession | null> {
    return window.api.hhcAuth.getSession()
  }

  signIn(): Promise<void> {
    return window.api.hhcAuth.begin()
  }

  getAccessToken(): Promise<string | null> {
    return window.api.hhcAuth.getAccessToken()
  }

  refreshAccessToken(): Promise<string | null> {
    return window.api.hhcAuth.refreshAccessToken()
  }

  signOut(): Promise<void> {
    return window.api.hhcAuth.signOut()
  }

  subscribe(listener: (session: HhcSession | null) => void): () => void {
    const cleanup = window.api.hhcAuth.onSessionChanged(listener)
    let active = true
    const unsubscribe = (): void => {
      if (!active) return
      active = false
      this.cleanups.delete(unsubscribe)
      cleanup()
    }
    this.cleanups.add(unsubscribe)
    return unsubscribe
  }

  dispose(): void {
    for (const unsubscribe of [...this.cleanups]) unsubscribe()
  }
}

export function createElectronHhcAuthAdapter(): ElectronHhcAuthAdapter {
  return new ElectronHhcAuthAdapter()
}
