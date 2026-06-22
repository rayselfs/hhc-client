import { createHash, randomBytes } from 'node:crypto'

const DAY_MS = 24 * 60 * 60 * 1000

interface TrustedDeviceRecord {
  id: string
  label: string
  secretHash: string
  createdAt: number
  lastUsedAt: number
  expiresAt: number
}

export interface TrustedDevicePublicRecord {
  id: string
  label: string
  createdAt: number
  lastUsedAt: number
  expiresAt: number
}

export interface TrustedDeviceStore {
  addTrustedDevice(
    label: string,
    durationDays: number,
    now?: number
  ): Promise<{ id: string; secret: string }>
  listTrustedDevices(): TrustedDevicePublicRecord[]
  verifyCredential(id: string, secret: string, now?: number): Promise<boolean>
  revokeTrustedDevice(id: string): void
  revokeAllTrustedDevices(): void
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

export function createTrustedDeviceStore(): TrustedDeviceStore {
  const records = new Map<string, TrustedDeviceRecord>()

  return {
    async addTrustedDevice(
      label: string,
      durationDays: number,
      now = Date.now()
    ): Promise<{ id: string; secret: string }> {
      const id = randomBytes(16).toString('base64url')
      const secret = randomBytes(32).toString('base64url')
      records.set(id, {
        id,
        label,
        secretHash: hashSecret(secret),
        createdAt: now,
        lastUsedAt: now,
        expiresAt: now + durationDays * DAY_MS
      })
      return { id, secret }
    },

    listTrustedDevices(): TrustedDevicePublicRecord[] {
      return [...records.values()].map((record) => ({
        id: record.id,
        label: record.label,
        createdAt: record.createdAt,
        lastUsedAt: record.lastUsedAt,
        expiresAt: record.expiresAt
      }))
    },

    async verifyCredential(id: string, secret: string, now = Date.now()): Promise<boolean> {
      const record = records.get(id)
      if (!record || record.expiresAt < now) {
        records.delete(id)
        return false
      }
      if (record.secretHash !== hashSecret(secret)) return false
      record.lastUsedAt = now
      return true
    },

    revokeTrustedDevice(id: string): void {
      records.delete(id)
    },

    revokeAllTrustedDevices(): void {
      records.clear()
    }
  }
}
