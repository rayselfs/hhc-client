export const HHC_AUTH_TRANSACTION_TTL_MS = 5 * 60_000
export const HHC_AUTH_CALLBACK_CHANNEL = 'hhc-auth-callback'

export interface HhcSession {
  userId: string
  displayName: string
  avatarUrl?: string
  roles: string[]
  permissions?: string[]
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

export function readHhcPermissions(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    !value.every((permission) => typeof permission === 'string' && permission.length > 0)
  ) {
    throw new Error('Invalid HHC account permissions')
  }
  return value
}

export function hasHhcPermission(
  permissions: readonly string[] | undefined,
  required: string
): boolean {
  return (
    required.length > 0 &&
    (permissions?.includes('*') === true || permissions?.includes(required) === true)
  )
}
