import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@renderer/lib/env', () => ({
  isElectron: vi.fn()
}))

import { isElectron } from '@renderer/lib/env'
import { createProjectionAdapter } from '../projection-adapter'

const mockPostMessage = vi.fn()
const mockAddEventListener = vi.fn()
const mockRemoveEventListener = vi.fn()
const mockClose = vi.fn()

const mockBroadcastChannelInstance = {
  postMessage: mockPostMessage,
  addEventListener: mockAddEventListener,
  removeEventListener: mockRemoveEventListener,
  close: mockClose
}

function MockBroadcastChannelFn(this: unknown): typeof mockBroadcastChannelInstance {
  return mockBroadcastChannelInstance
}
const MockBroadcastChannel = vi.fn(MockBroadcastChannelFn)
vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)

const mockProjectionUnsubscribe = vi.fn()
const mockProjectionApi = {
  send: vi.fn<(channel: string, data: unknown) => void>(),
  onProjectionMessage: vi.fn<(callback: (ch: string, d: unknown) => void) => () => void>(
    () => mockProjectionUnsubscribe
  )
}

function setupWindowApi(): void {
  Object.defineProperty(window, 'api', {
    value: { projection: mockProjectionApi },
    writable: true,
    configurable: true
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  MockBroadcastChannel.mockImplementation(MockBroadcastChannelFn)
  mockProjectionApi.onProjectionMessage.mockReturnValue(mockProjectionUnsubscribe)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('BroadcastChannelAdapter', () => {
  beforeEach(() => {
    vi.mocked(isElectron).mockReturnValue(false)
  })

  it('send() calls bc.postMessage with { channel, data, sender }', () => {
    const adapter = createProjectionAdapter()
    adapter.send('projection:text', 'hello')

    expect(mockPostMessage).toHaveBeenCalledOnce()
    const arg = mockPostMessage.mock.calls[0][0]
    expect(arg.channel).toBe('projection:text')
    expect(arg.data).toBe('hello')
    expect(typeof arg.sender).toBe('string')
    expect(arg.sender.length).toBeGreaterThan(0)
  })

  it('on() registers a message event listener on bc', () => {
    const adapter = createProjectionAdapter()
    adapter.on('projection:text', vi.fn())

    expect(mockAddEventListener).toHaveBeenCalledOnce()
    expect(mockAddEventListener.mock.calls[0][0]).toBe('message')
  })

  it('on() — handler is called when message arrives with matching channel and different sender', () => {
    const adapter = createProjectionAdapter()
    const handler = vi.fn()
    adapter.on('projection:text', handler)

    const [, listener] = mockAddEventListener.mock.calls[0] as [string, (e: MessageEvent) => void]
    listener({
      data: { channel: 'projection:text', data: 'hello', sender: 'other-window-id' }
    } as MessageEvent)

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith('hello')
  })

  it('on() — handler is NOT called when sender === own windowId (self-filter)', () => {
    const adapter = createProjectionAdapter()
    const handler = vi.fn()
    adapter.on('projection:text', handler)

    adapter.send('projection:text', 'test')
    const ownSender = mockPostMessage.mock.calls[0][0].sender

    const [, listener] = mockAddEventListener.mock.calls[0] as [string, (e: MessageEvent) => void]
    listener({
      data: { channel: 'projection:text', data: 'hello', sender: ownSender }
    } as MessageEvent)

    expect(handler).not.toHaveBeenCalled()
  })

  it('on() — handler is NOT called when channel does not match', () => {
    const adapter = createProjectionAdapter()
    const handler = vi.fn()
    adapter.on('projection:text', handler)

    const [, listener] = mockAddEventListener.mock.calls[0] as [string, (e: MessageEvent) => void]
    listener({
      data: { channel: '__system:ping', data: null, sender: 'other-window-id' }
    } as MessageEvent)

    expect(handler).not.toHaveBeenCalled()
  })

  it('on() returns unsubscribe fn; after calling it, subsequent messages do not trigger handler', () => {
    const adapter = createProjectionAdapter()
    const handler = vi.fn()
    const unsubscribe = adapter.on('projection:text', handler)

    unsubscribe()

    expect(mockRemoveEventListener).toHaveBeenCalledOnce()
    expect(mockRemoveEventListener.mock.calls[0][0]).toBe('message')
  })

  it('dispose() removes listeners and closes the channel', () => {
    const adapter = createProjectionAdapter()
    adapter.on('__system:pong', vi.fn())

    adapter.dispose()

    expect(mockRemoveEventListener).toHaveBeenCalled()
    expect(mockClose).toHaveBeenCalledOnce()
  })

  it('send() with system channel sends null payload correctly', () => {
    const adapter = createProjectionAdapter()
    adapter.send('__system:pong', null)

    expect(mockPostMessage).toHaveBeenCalledOnce()
    const arg = mockPostMessage.mock.calls[0][0]
    expect(arg.channel).toBe('__system:pong')
    expect(arg.data).toBeNull()
  })
})

describe('ElectronProjectionAdapter', () => {
  beforeEach(() => {
    vi.mocked(isElectron).mockReturnValue(true)
    setupWindowApi()
  })

  it('send() delegates to api.send(channel, data)', () => {
    const adapter = createProjectionAdapter()
    adapter.send('projection:text', 'hello')

    expect(mockProjectionApi.send).toHaveBeenCalledOnce()
    expect(mockProjectionApi.send).toHaveBeenCalledWith('projection:text', 'hello')
  })

  it('on() registers callback via api.onProjectionMessage', () => {
    const adapter = createProjectionAdapter()
    adapter.on('projection:text', vi.fn())

    expect(mockProjectionApi.onProjectionMessage).toHaveBeenCalledOnce()
  })

  it('on() — handler fires when api.onProjectionMessage is called with matching channel', () => {
    const adapter = createProjectionAdapter()
    const handler = vi.fn()
    adapter.on('projection:text', handler)

    const registeredCallback = mockProjectionApi.onProjectionMessage.mock
      .calls[0][0] as unknown as (ch: string, d: unknown) => void
    registeredCallback('projection:text', 'payload-data')

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith('payload-data')
  })

  it('on() — handler does NOT fire when api.onProjectionMessage is called with non-matching channel', () => {
    const adapter = createProjectionAdapter()
    const handler = vi.fn()
    adapter.on('projection:text', handler)

    const registeredCallback = mockProjectionApi.onProjectionMessage.mock
      .calls[0][0] as unknown as (ch: string, d: unknown) => void
    registeredCallback('__system:ping', null)

    expect(handler).not.toHaveBeenCalled()
  })

  it('on() returns unsubscribe fn that calls the unsubscriber returned by api.onProjectionMessage', () => {
    const adapter = createProjectionAdapter()
    const unsubscribe = adapter.on('projection:text', vi.fn())

    unsubscribe()

    expect(mockProjectionUnsubscribe).toHaveBeenCalledOnce()
  })

  it('dispose() calls all stored unsubscribers', () => {
    const unsub1 = vi.fn()
    const unsub2 = vi.fn()
    mockProjectionApi.onProjectionMessage.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2)

    const adapter = createProjectionAdapter()
    adapter.on('projection:text', vi.fn())
    adapter.on('__system:pong', vi.fn())
    adapter.dispose()

    expect(unsub1).toHaveBeenCalledOnce()
    expect(unsub2).toHaveBeenCalledOnce()
  })
})

describe('createProjectionAdapter factory', () => {
  it('returns ElectronProjectionAdapter when isElectron() returns true', () => {
    vi.mocked(isElectron).mockReturnValue(true)
    setupWindowApi()

    const adapter = createProjectionAdapter()
    adapter.send('projection:text', 'data')
    expect(mockProjectionApi.send).toHaveBeenCalledWith('projection:text', 'data')
    expect(mockPostMessage).not.toHaveBeenCalled()
  })

  it('returns BroadcastChannelAdapter when isElectron() returns false', () => {
    vi.mocked(isElectron).mockReturnValue(false)

    const adapter = createProjectionAdapter()
    adapter.send('projection:text', 'data')
    expect(mockPostMessage).toHaveBeenCalledOnce()
    expect(mockProjectionApi.send).not.toHaveBeenCalled()
  })
})
