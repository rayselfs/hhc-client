export interface HhcSession {
  userId: string
  displayName: string
  avatarUrl?: string
  roles: string[]
}

export interface HhcAuthAdapter {
  getSession(): Promise<HhcSession | null>
  signIn(): Promise<void>
  getAccessToken(): Promise<string | null>
  signOut(): Promise<void>
  subscribe(listener: (session: HhcSession | null) => void): () => void
  dispose(): void
}
