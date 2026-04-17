import { isElectron } from '@renderer/lib/env'
import type { ProjectionChannel, ProjectionPayload } from '@shared/projection-messages'

type AdapterRole = 'main' | 'projection'

interface ProjectionAdapter {
  send<C extends ProjectionChannel>(channel: C, data: ProjectionPayload<C>): void
  on<C extends ProjectionChannel>(
    channel: C,
    handler: (data: ProjectionPayload<C>) => void
  ): () => void
  dispose(): void
}

class ElectronProjectionAdapter implements ProjectionAdapter {
  private api: Window['api']['projection']
  private unsubscribers = new Set<() => void>()
  private role: AdapterRole

  constructor(api: Window['api']['projection'], role: AdapterRole) {
    this.api = api
    this.role = role
  }

  send<C extends ProjectionChannel>(channel: C, data: ProjectionPayload<C>): void {
    if (this.role === 'projection') {
      this.api.sendToMain(channel, data)
    } else {
      this.api.send(channel, data)
    }
  }

  on<C extends ProjectionChannel>(
    channel: C,
    handler: (data: ProjectionPayload<C>) => void
  ): () => void {
    const unsubscribe = this.api.onProjectionMessage((ch, d) => {
      if ((ch as string) === channel) handler(d as ProjectionPayload<C>)
    })
    this.unsubscribers.add(unsubscribe)
    return () => {
      unsubscribe()
      this.unsubscribers.delete(unsubscribe)
    }
  }

  dispose(): void {
    this.unsubscribers.forEach((unsub) => unsub())
    this.unsubscribers.clear()
  }
}

class BroadcastChannelAdapter implements ProjectionAdapter {
  private bc: BroadcastChannel
  private windowId: string
  private listeners: Array<{ listener: (event: MessageEvent) => void }> = []
  private disposed = false

  constructor() {
    this.bc = new BroadcastChannel('hhc-projection')
    this.windowId = crypto.randomUUID()

    this.bc.addEventListener('messageerror', () => {
      console.warn('[projection-adapter] Failed to deserialize BroadcastChannel message')
    })
  }

  send<C extends ProjectionChannel>(channel: C, data: ProjectionPayload<C>): void {
    if (this.disposed) return
    this.bc.postMessage({ channel, data, sender: this.windowId })
  }

  on<C extends ProjectionChannel>(
    channel: C,
    handler: (data: ProjectionPayload<C>) => void
  ): () => void {
    const listener = (event: MessageEvent): void => {
      const msg = event.data
      if (!msg || typeof msg !== 'object' || !('channel' in msg) || !('sender' in msg)) return
      if (msg.sender === this.windowId) return
      if (msg.channel === channel) handler(msg.data as ProjectionPayload<C>)
    }
    this.bc.addEventListener('message', listener)
    this.listeners.push({ listener })
    return () => {
      this.bc.removeEventListener('message', listener)
      this.listeners = this.listeners.filter((l) => l.listener !== listener)
    }
  }

  dispose(): void {
    this.disposed = true
    this.listeners.forEach(({ listener }) => this.bc.removeEventListener('message', listener))
    this.listeners = []
    this.bc.close()
  }
}

function createProjectionAdapter(role: AdapterRole = 'main'): ProjectionAdapter {
  if (isElectron()) return new ElectronProjectionAdapter(window.api.projection, role)
  return new BroadcastChannelAdapter()
}

export type { ProjectionAdapter }
export { createProjectionAdapter }
