export const HHC_AUTH_TRANSACTION_TTL_MS = 5 * 60_000
export const HHC_AUTH_CALLBACK_CHANNEL = 'hhc-auth-callback'

export interface HhcSession {
  userId: string
  displayName: string
  avatarUrl?: string
  roles: string[]
  presenterCloudAccess?: boolean
}

export interface HhcPendingSignIn {
  expiresAt: number
}

export interface HhcAuthAdapter {
  getSession(): Promise<HhcSession | null>
  signIn(): Promise<HhcPendingSignIn>
  cancelSignIn(): Promise<void>
  getAccessToken(): Promise<string | null>
  refreshAccessToken(): Promise<string | null>
  signOut(): Promise<void>
  subscribe(listener: (session: HhcSession | null) => void): () => void
  dispose(): void
}
