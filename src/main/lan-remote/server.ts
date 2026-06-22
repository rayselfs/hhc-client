import { randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import {
  isPrivateLanAddress,
  type LanRemoteAck,
  type LanRemoteCommand
} from '../../shared/lan-remote'
import { getLanRemoteMobileHtml } from './mobile-ui'

export interface LanRemoteServerStartOptions {
  host: string
  port: number
}

export interface LanRemotePairingRecord {
  secret: string
  deviceName: string
  expiresAt: number
}

export interface LanRemoteServerStatus {
  enabled: boolean
  host: string
  port: number
}

export interface LanRemoteServerOptions {
  commandHandler: (command: LanRemoteCommand) => Promise<LanRemoteAck>
}

export interface LanRemoteServerController {
  start(options: LanRemoteServerStartOptions): Promise<void>
  stop(): Promise<void>
  createPairingSecret(deviceName: string): {
    secret: string
    url: string
    expiresAt: number
  }
  consumePairingSecret(secret: string): LanRemotePairingRecord | null
  getStatus(): LanRemoteServerStatus
}

export function createLanRemoteServer(_options: LanRemoteServerOptions): LanRemoteServerController {
  let server: Server | null = null
  let host = ''
  let port = 0
  const pairings = new Map<string, LanRemotePairingRecord>()

  return {
    async start(options: LanRemoteServerStartOptions): Promise<void> {
      if (server) return
      if (!isPrivateLanAddress(options.host)) {
        throw new Error('LAN remote requires a private LAN interface')
      }

      host = options.host
      port = options.port
      server = createServer((req, res) => {
        if (req.url === '/' || req.url?.startsWith('/pair/')) {
          res.setHeader('content-type', 'text/html; charset=utf-8')
          res.end(getLanRemoteMobileHtml())
          return
        }

        res.statusCode = 404
        res.end('Not found')
      })

      await new Promise<void>((resolve) => server?.listen(port, resolve))
      const address = server.address()
      if (typeof address === 'object' && address) {
        port = address.port
      }
    },

    async stop(): Promise<void> {
      if (!server) return

      const current = server
      server = null
      pairings.clear()
      await new Promise<void>((resolve, reject) => {
        current.close((error) => (error ? reject(error) : resolve()))
      })
    },

    createPairingSecret(deviceName: string): {
      secret: string
      url: string
      expiresAt: number
    } {
      const secret = randomBytes(32).toString('base64url')
      const expiresAt = Date.now() + 2 * 60 * 1000
      pairings.set(secret, { secret, deviceName, expiresAt })
      return { secret, expiresAt, url: `http://${host}:${port}/pair/${secret}` }
    },

    consumePairingSecret(secret: string): LanRemotePairingRecord | null {
      const record = pairings.get(secret)
      pairings.delete(secret)
      if (!record || record.expiresAt < Date.now()) return null
      return record
    },

    getStatus(): LanRemoteServerStatus {
      return { enabled: server !== null, host, port }
    }
  }
}
