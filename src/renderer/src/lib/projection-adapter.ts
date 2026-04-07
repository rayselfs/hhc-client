import { isElectron } from '@renderer/lib/env'

interface ProjectionAdapter {
  send(channel: string, data?: unknown): void
  on(channel: string, handler: (data: unknown) => void): () => void
  dispose(): void
}

class ElectronProjectionAdapter implements ProjectionAdapter {
  private api: Window['api']['projection']
  private unsubscribers: Array<() => void> = []

  constructor(api: Window['api']['projection']) {
    this.api = api
  }

  send(channel: string, data?: unknown): void {
    this.api.send(channel, data)
  }

  on(channel: string, handler: (data: unknown) => void): () => void {
    const unsubscribe = this.api.onProjectionMessage((ch, d) => {
      if (ch === channel) handler(d)
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

  send(channel: string, data?: unknown): void {
    this.bc.postMessage({ channel, data, sender: this.windowId })
  }

  on(channel: string, handler: (data: unknown) => void): () => void {
    const listener = (event: MessageEvent): void => {
      if (event.data.sender === this.windowId) return
      if (event.data.channel === channel) handler(event.data.data)
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
    // Do NOT close the BroadcastChannel — it must remain open for send() to work.
    // The channel is garbage-collected when the adapter is dereferenced.
  }
}

function createProjectionAdapter(): ProjectionAdapter {
  if (isElectron()) return new ElectronProjectionAdapter(window.api.projection)
  return new BroadcastChannelAdapter()
}

export type { ProjectionAdapter }
export { createProjectionAdapter }
