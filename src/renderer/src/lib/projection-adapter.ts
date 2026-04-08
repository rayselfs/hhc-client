import { isElectron } from '@renderer/lib/env'
import type { ProjectionChannel, ProjectionPayload } from '@shared/projection-messages'

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
  private unsubscribers: Array<() => void> = []

  constructor(api: Window['api']['projection']) {
    this.api = api
  }

  send<C extends ProjectionChannel>(channel: C, data: ProjectionPayload<C>): void {
    this.api.send(channel, data)
  }

  on<C extends ProjectionChannel>(
    channel: C,
    handler: (data: ProjectionPayload<C>) => void
  ): () => void {
    const unsubscribe = this.api.onProjectionMessage((ch, d) => {
      if ((ch as string) === channel) handler(d as ProjectionPayload<C>)
    })
    this.unsubscribers.push(unsubscribe)
    return unsubscribe
  }

  dispose(): void {
    this.unsubscribers.forEach((unsub) => unsub())
    this.unsubscribers = []
  }
}

class BroadcastChannelAdapter implements ProjectionAdapter {
  private bc: BroadcastChannel
  private windowId: string
  private listeners: Array<{ listener: (event: MessageEvent) => void }> = []

  constructor() {
    this.bc = new BroadcastChannel('hhc-projection')
    this.windowId = crypto.randomUUID()
  }

  send<C extends ProjectionChannel>(channel: C, data: ProjectionPayload<C>): void {
    this.bc.postMessage({ channel, data, sender: this.windowId })
  }

  on<C extends ProjectionChannel>(
    channel: C,
    handler: (data: ProjectionPayload<C>) => void
  ): () => void {
    const listener = (event: MessageEvent): void => {
      if (event.data.sender === this.windowId) return
      if (event.data.channel === channel) handler(event.data.data as ProjectionPayload<C>)
    }
    this.bc.addEventListener('message', listener)
    this.listeners.push({ listener })
    return () => {
      this.bc.removeEventListener('message', listener)
      this.listeners = this.listeners.filter((l) => l.listener !== listener)
    }
  }

  dispose(): void {
    this.listeners.forEach(({ listener }) => this.bc.removeEventListener('message', listener))
    this.listeners = []
  }
}

function createProjectionAdapter(): ProjectionAdapter {
  if (isElectron()) return new ElectronProjectionAdapter(window.api.projection)
  return new BroadcastChannelAdapter()
}

export type { ProjectionAdapter }
export { createProjectionAdapter }
