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
    return () => this.bc.removeEventListener('message', listener)
  }

  dispose(): void {
    this.bc.close()
  }
}

function createProjectionAdapter(): ProjectionAdapter {
  if (isElectron()) return new ElectronProjectionAdapter(window.api.projection)
  return new BroadcastChannelAdapter()
}

export type { ProjectionAdapter }
export { createProjectionAdapter }
