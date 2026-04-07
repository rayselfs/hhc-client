import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../../../shared/env', () => ({
  isElectron: vi.fn()
}))

import { isElectron } from '../../../../shared/env'
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
    adapter.send('test-channel', { foo: 'bar' })

    expect(mockPostMessage).toHaveBeenCalledOnce()
    const arg = mockPostMessage.mock.calls[0][0]
    expect(arg.channel).toBe('test-channel')
    expect(arg.data).toEqual({ foo: 'bar' })
    expect(typeof arg.sender).toBe('string')
    expect(arg.sender.length).toBeGreaterThan(0)
  })

  it('on() registers a message event listener on bc', () => {
    const adapter = createProjectionAdapter()
    adapter.on('test-channel', vi.fn())

    expect(mockAddEventListener).toHaveBeenCalledOnce()
    expect(mockAddEventListener.mock.calls[0][0]).toBe('message')
  })

  it('on() — handler is called when message arrives with matching channel and different sender', () => {
    const adapter = createProjectionAdapter()
    const handler = vi.fn()
    adapter.on('my-channel', handler)

    const [, listener] = mockAddEventListener.mock.calls[0] as [string, (e: MessageEvent) => void]
    listener({
      data: { channel: 'my-channel', data: 'hello', sender: 'other-window-id' }
    } as MessageEvent)

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith('hello')
  })

  it('on() — handler is NOT called when sender === own windowId (self-filter)', () => {
    const adapter = createProjectionAdapter()
    const handler = vi.fn()
    adapter.on('my-channel', handler)

    adapter.send('my-channel', 'test')
    const ownSender = mockPostMessage.mock.calls[0][0].sender

    const [, listener] = mockAddEventListener.mock.calls[0] as [string, (e: MessageEvent) => void]
    listener({ data: { channel: 'my-channel', data: 'hello', sender: ownSender } } as MessageEvent)

    expect(handler).not.toHaveBeenCalled()
  })

  it('on() — handler is NOT called when channel does not match', () => {
    const adapter = createProjectionAdapter()
    const handler = vi.fn()
    adapter.on('my-channel', handler)

    const [, listener] = mockAddEventListener.mock.calls[0] as [string, (e: MessageEvent) => void]
    listener({
      data: { channel: 'other-channel', data: 'hello', sender: 'other-window-id' }
    } as MessageEvent)

    expect(handler).not.toHaveBeenCalled()
  })

  it('on() returns unsubscribe fn; after calling it, subsequent messages do not trigger handler', () => {
    const adapter = createProjectionAdapter()
    const handler = vi.fn()
    const unsubscribe = adapter.on('my-channel', handler)

    unsubscribe()

    expect(mockRemoveEventListener).toHaveBeenCalledOnce()
    expect(mockRemoveEventListener.mock.calls[0][0]).toBe('message')
  })

  it('dispose() calls bc.close()', () => {
    const adapter = createProjectionAdapter()
    adapter.dispose()

    expect(mockClose).toHaveBeenCalledOnce()
  })
})

describe('ElectronProjectionAdapter', () => {
  beforeEach(() => {
    vi.mocked(isElectron).mockReturnValue(true)
    setupWindowApi()
  })

  it('send() delegates to api.send(channel, data)', () => {
    const adapter = createProjectionAdapter()
    adapter.send('some-channel', { x: 1 })

    expect(mockProjectionApi.send).toHaveBeenCalledOnce()
    expect(mockProjectionApi.send).toHaveBeenCalledWith('some-channel', { x: 1 })
  })

  it('on() registers callback via api.onProjectionMessage', () => {
    const adapter = createProjectionAdapter()
    adapter.on('some-channel', vi.fn())

    expect(mockProjectionApi.onProjectionMessage).toHaveBeenCalledOnce()
  })

  it('on() — handler fires when api.onProjectionMessage is called with matching channel', () => {
    const adapter = createProjectionAdapter()
    const handler = vi.fn()
    adapter.on('my-channel', handler)

    const registeredCallback = mockProjectionApi.onProjectionMessage.mock
      .calls[0][0] as unknown as (ch: string, d: unknown) => void
    registeredCallback('my-channel', 'payload-data')

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith('payload-data')
  })

  it('on() — handler does NOT fire when api.onProjectionMessage is called with non-matching channel', () => {
    const adapter = createProjectionAdapter()
    const handler = vi.fn()
    adapter.on('my-channel', handler)

    const registeredCallback = mockProjectionApi.onProjectionMessage.mock
      .calls[0][0] as unknown as (ch: string, d: unknown) => void
    registeredCallback('other-channel', 'payload-data')

    expect(handler).not.toHaveBeenCalled()
  })

  it('on() returns unsubscribe fn that calls the unsubscriber returned by api.onProjectionMessage', () => {
    const adapter = createProjectionAdapter()
    const unsubscribe = adapter.on('my-channel', vi.fn())

    unsubscribe()

    expect(mockProjectionUnsubscribe).toHaveBeenCalledOnce()
  })

  it('dispose() calls all stored unsubscribers', () => {
    const unsub1 = vi.fn()
    const unsub2 = vi.fn()
    mockProjectionApi.onProjectionMessage.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2)

    const adapter = createProjectionAdapter()
    adapter.on('channel-1', vi.fn())
    adapter.on('channel-2', vi.fn())
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
    adapter.send('test', 'data')
    expect(mockProjectionApi.send).toHaveBeenCalledWith('test', 'data')
    expect(mockPostMessage).not.toHaveBeenCalled()
  })

  it('returns BroadcastChannelAdapter when isElectron() returns false', () => {
    vi.mocked(isElectron).mockReturnValue(false)

    const adapter = createProjectionAdapter()
    adapter.send('test', 'data')
    expect(mockPostMessage).toHaveBeenCalledOnce()
    expect(mockProjectionApi.send).not.toHaveBeenCalled()
  })
})
