import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { WorkerOutgoingMessage } from '@renderer/workers/bible-search.worker'

vi.mock('@renderer/lib/bible-db', () => ({
  saveFlexSearchCache: vi.fn(),
  loadFlexSearchCache: vi.fn()
}))

vi.mock('@renderer/stores/bible-search', () => ({
  useBibleSearchStore: Object.assign(() => ({}), {
    getState: () => ({ setIndexReady: vi.fn() }),
    subscribe: () => () => {}
  })
}))

import { BibleSearchEngine } from '../bible-search'

type MessageHandler = (event: MessageEvent<WorkerOutgoingMessage>) => void
type ErrorHandler = (event: ErrorEvent) => void

interface MockWorker {
  postMessage: ReturnType<typeof vi.fn>
  terminate: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  onmessage: null
  _triggerMessage: (data: WorkerOutgoingMessage) => void
  _triggerError: (message: string) => void
}

function makeMockWorker(): MockWorker {
  const messageListeners: MessageHandler[] = []
  const errorListeners: ErrorHandler[] = []

  const worker: MockWorker = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn((type: string, handler: MessageHandler | ErrorHandler) => {
      if (type === 'message') messageListeners.push(handler as MessageHandler)
      if (type === 'error') errorListeners.push(handler as ErrorHandler)
    }),
    removeEventListener: vi.fn((type: string, handler: MessageHandler | ErrorHandler) => {
      if (type === 'message') {
        const idx = messageListeners.indexOf(handler as MessageHandler)
        if (idx !== -1) messageListeners.splice(idx, 1)
      }
    }),
    onmessage: null,
    _triggerMessage(data: WorkerOutgoingMessage) {
      const event = new MessageEvent('message', { data })
      for (const l of [...messageListeners]) l(event)
    },
    _triggerError(message: string) {
      const event = new ErrorEvent('error', { message })
      for (const l of [...errorListeners]) l(event)
    }
  }
  return worker
}

let mockWorker: MockWorker
let MockWorkerConstructor: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockWorker = makeMockWorker()
  MockWorkerConstructor = vi.fn(function () {
    return mockWorker
  })
  vi.stubGlobal('Worker', MockWorkerConstructor)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('BibleSearchEngine', () => {
  describe('init', () => {
    it('creates a Worker and posts INIT message', async () => {
      const engine = new BibleSearchEngine()
      const initPromise = engine.init()
      mockWorker._triggerMessage({ type: 'READY' })
      await initPromise

      expect(MockWorkerConstructor).toHaveBeenCalledOnce()
      expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'INIT' })
    })

    it('resolves when READY message is received', async () => {
      const engine = new BibleSearchEngine()
      const initPromise = engine.init()
      mockWorker._triggerMessage({ type: 'READY' })
      await expect(initPromise).resolves.toBeUndefined()
    })

    it('isReady() returns true after init resolves', async () => {
      const engine = new BibleSearchEngine()
      expect(engine.isReady()).toBe(false)
      const initPromise = engine.init()
      mockWorker._triggerMessage({ type: 'READY' })
      await initPromise
      expect(engine.isReady()).toBe(true)
    })

    it('rejects when ERROR message is received during init', async () => {
      const engine = new BibleSearchEngine()
      const initPromise = engine.init()
      mockWorker._triggerMessage({ type: 'ERROR', message: 'init failed' })
      await expect(initPromise).rejects.toThrow('init failed')
    })

    it('rejects when Worker emits error event during init', async () => {
      const engine = new BibleSearchEngine()
      const initPromise = engine.init()
      mockWorker._triggerError('worker crashed')
      await expect(initPromise).rejects.toThrow('worker crashed')
    })

    it('does nothing and returns immediately if already initialized', async () => {
      const engine = new BibleSearchEngine()
      const p1 = engine.init()
      mockWorker._triggerMessage({ type: 'READY' })
      await p1

      const callCount = MockWorkerConstructor.mock.calls.length
      await engine.init()
      expect(MockWorkerConstructor.mock.calls.length).toBe(callCount)
    })
  })

  describe('buildIndex', () => {
    async function makeReadyEngine(): Promise<BibleSearchEngine> {
      const engine = new BibleSearchEngine()
      const p = engine.init()
      mockWorker._triggerMessage({ type: 'READY' })
      await p
      return engine
    }

    it('posts BUILD_INDEX message with verses', async () => {
      const engine = await makeReadyEngine()
      const verses = [
        { id: 1, text: 'In the beginning God created' },
        { id: 2, text: 'And the earth was without form' }
      ]

      const buildPromise = engine.buildIndex(verses)
      mockWorker._triggerMessage({ type: 'INDEX_COMPLETE', total: 2 })
      await buildPromise

      expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'BUILD_INDEX', verses })
    })

    it('resolves when INDEX_COMPLETE is received', async () => {
      const engine = await makeReadyEngine()
      const verses = [{ id: 1, text: 'test verse' }]

      const buildPromise = engine.buildIndex(verses)
      mockWorker._triggerMessage({ type: 'INDEX_COMPLETE', total: 1 })
      await expect(buildPromise).resolves.toBeUndefined()
    })

    it('rejects if worker not initialized', async () => {
      const engine = new BibleSearchEngine()
      await expect(engine.buildIndex([{ id: 1, text: 'x' }])).rejects.toThrow(
        'BibleSearchEngine not initialized'
      )
    })

    it('rejects on ERROR message during build', async () => {
      const engine = await makeReadyEngine()
      const buildPromise = engine.buildIndex([{ id: 1, text: 'x' }])
      mockWorker._triggerMessage({ type: 'ERROR', message: 'build failed' })
      await expect(buildPromise).rejects.toThrow('build failed')
    })

    it('updates progress via PROGRESS messages', async () => {
      const engine = await makeReadyEngine()
      const verses = Array.from({ length: 2000 }, (_, i) => ({ id: i + 1, text: `verse ${i + 1}` }))

      const buildPromise = engine.buildIndex(verses)
      mockWorker._triggerMessage({ type: 'PROGRESS', indexed: 1000, total: 2000 })
      expect(engine.getProgress()).toEqual({ indexed: 1000, total: 2000 })

      mockWorker._triggerMessage({ type: 'INDEX_COMPLETE', total: 2000 })
      await buildPromise
    })
  })

  describe('search', () => {
    async function makeIndexedEngine(): Promise<BibleSearchEngine> {
      const engine = new BibleSearchEngine()
      const p = engine.init()
      mockWorker._triggerMessage({ type: 'READY' })
      await p

      const buildPromise = engine.buildIndex([
        { id: 1, text: 'In the beginning God created the heavens and the earth' },
        { id: 2, text: 'And God said let there be light' },
        { id: 3, text: 'God saw that the light was good' }
      ])
      mockWorker._triggerMessage({ type: 'INDEX_COMPLETE', total: 3 })
      await buildPromise

      return engine
    }

    it('posts SEARCH message with correct query, limit, and id', async () => {
      const engine = await makeIndexedEngine()

      const searchPromise = engine.search('God', 10)
      const lastCall = mockWorker.postMessage.mock.calls.at(-1)?.[0]
      expect(lastCall).toMatchObject({ type: 'SEARCH', query: 'God', limit: 10 })
      expect(typeof lastCall?.id).toBe('number')

      mockWorker._triggerMessage({ type: 'SEARCH_RESULT', id: lastCall.id, results: [1, 2, 3] })
      const results = await searchPromise
      expect(results).toEqual([1, 2, 3])
    })

    it('resolves with result IDs matching the search id', async () => {
      const engine = await makeIndexedEngine()

      const s1 = engine.search('light')
      const call = mockWorker.postMessage.mock.calls.at(-1)?.[0]
      mockWorker._triggerMessage({ type: 'SEARCH_RESULT', id: call.id, results: [2, 3] })
      expect(await s1).toEqual([2, 3])
    })

    it('resolves with empty array when no results', async () => {
      const engine = await makeIndexedEngine()

      const s = engine.search('nonexistent')
      const call = mockWorker.postMessage.mock.calls.at(-1)?.[0]
      mockWorker._triggerMessage({ type: 'SEARCH_RESULT', id: call.id, results: [] })
      expect(await s).toEqual([])
    })

    it('supports concurrent searches resolved independently', async () => {
      const engine = await makeIndexedEngine()

      const s1 = engine.search('God')
      const call1 = mockWorker.postMessage.mock.calls.at(-1)?.[0]

      const s2 = engine.search('light')
      const call2 = mockWorker.postMessage.mock.calls.at(-1)?.[0]

      mockWorker._triggerMessage({ type: 'SEARCH_RESULT', id: call2.id, results: [2, 3] })
      mockWorker._triggerMessage({ type: 'SEARCH_RESULT', id: call1.id, results: [1, 2] })

      expect(await s1).toEqual([1, 2])
      expect(await s2).toEqual([2, 3])
    })

    it('uses default limit of 20 when not specified', async () => {
      const engine = await makeIndexedEngine()

      engine.search('God')
      const call = mockWorker.postMessage.mock.calls.at(-1)?.[0]
      expect(call.limit).toBe(20)
    })

    it('rejects if worker not initialized', async () => {
      const engine = new BibleSearchEngine()
      await expect(engine.search('test')).rejects.toThrow('BibleSearchEngine not initialized')
    })

    it('rejects all pending searches on ERROR message', async () => {
      const engine = await makeIndexedEngine()

      const s1 = engine.search('God')
      const s2 = engine.search('earth')

      mockWorker._triggerMessage({ type: 'ERROR', message: 'worker crashed' })

      await expect(s1).rejects.toThrow('worker crashed')
      await expect(s2).rejects.toThrow('worker crashed')
    })
  })

  describe('getProgress', () => {
    it('returns { indexed: 0, total: 0 } initially', () => {
      const engine = new BibleSearchEngine()
      expect(engine.getProgress()).toEqual({ indexed: 0, total: 0 })
    })

    it('returns updated values after INDEX_COMPLETE', async () => {
      const engine = new BibleSearchEngine()
      const p = engine.init()
      mockWorker._triggerMessage({ type: 'READY' })
      await p

      const buildPromise = engine.buildIndex([{ id: 1, text: 'x' }])
      mockWorker._triggerMessage({ type: 'INDEX_COMPLETE', total: 1 })
      await buildPromise

      expect(engine.getProgress()).toEqual({ indexed: 1, total: 1 })
    })
  })

  describe('dispose', () => {
    it('terminates the worker', async () => {
      const engine = new BibleSearchEngine()
      const p = engine.init()
      mockWorker._triggerMessage({ type: 'READY' })
      await p

      engine.dispose()
      expect(mockWorker.terminate).toHaveBeenCalledOnce()
    })

    it('sets isReady() to false after dispose', async () => {
      const engine = new BibleSearchEngine()
      const p = engine.init()
      mockWorker._triggerMessage({ type: 'READY' })
      await p

      engine.dispose()
      expect(engine.isReady()).toBe(false)
    })

    it('rejects pending searches with "disposed" error', async () => {
      const engine = new BibleSearchEngine()
      const p = engine.init()
      mockWorker._triggerMessage({ type: 'READY' })
      await p

      const buildPromise = engine.buildIndex([{ id: 1, text: 'x' }])
      mockWorker._triggerMessage({ type: 'INDEX_COMPLETE', total: 1 })
      await buildPromise

      const searchPromise = engine.search('test')
      engine.dispose()
      await expect(searchPromise).rejects.toThrow('disposed')
    })

    it('resets progress to 0 after dispose', async () => {
      const engine = new BibleSearchEngine()
      const p = engine.init()
      mockWorker._triggerMessage({ type: 'READY' })
      await p

      const buildPromise = engine.buildIndex([{ id: 1, text: 'x' }])
      mockWorker._triggerMessage({ type: 'INDEX_COMPLETE', total: 1 })
      await buildPromise

      engine.dispose()
      expect(engine.getProgress()).toEqual({ indexed: 0, total: 0 })
    })
  })
})
