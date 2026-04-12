import { Index } from 'flexsearch'
import init, { cut } from 'jieba-wasm'

// ─── Message Protocol ──────────────────────────────────────────────────────

export type WorkerIncomingMessage =
  | { type: 'INIT' }
  | { type: 'BUILD_INDEX'; verses: { id: number; text: string }[] }
  | { type: 'SEARCH'; query: string; limit?: number; id: number }
  | { type: 'GET_PROGRESS'; id: number }

export type WorkerOutgoingMessage =
  | { type: 'READY' }
  | { type: 'INDEX_COMPLETE'; total: number }
  | { type: 'PROGRESS'; indexed: number; total: number }
  | { type: 'SEARCH_RESULT'; id: number; results: number[] }
  | { type: 'PROGRESS_RESULT'; id: number; indexed: number; total: number }
  | { type: 'ERROR'; message: string }

// ─── State ─────────────────────────────────────────────────────────────────

const BATCH_SIZE = 1000

let flexIndex: Index | null = null
let jiebaReady = false
let indexed = 0
let total = 0

// ─── Jieba encoder for FlexSearch ──────────────────────────────────────────

function jiebaEncode(text: string): string[] {
  if (!jiebaReady) return text.split('')
  return cut(text, true)
}

// ─── Handlers ──────────────────────────────────────────────────────────────

async function handleInit(): Promise<void> {
  try {
    await init()
    jiebaReady = true
    flexIndex = new Index({ encode: jiebaEncode, tokenize: 'strict' })
    self.postMessage({ type: 'READY' } satisfies WorkerOutgoingMessage)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    self.postMessage({ type: 'ERROR', message } satisfies WorkerOutgoingMessage)
  }
}

async function handleBuildIndex(verses: { id: number; text: string }[]): Promise<void> {
  if (!flexIndex) {
    self.postMessage({
      type: 'ERROR',
      message: 'Index not initialized'
    } satisfies WorkerOutgoingMessage)
    return
  }

  total = verses.length
  indexed = 0
  flexIndex.clear()

  for (let i = 0; i < verses.length; i += BATCH_SIZE) {
    const batch = verses.slice(i, i + BATCH_SIZE)
    for (const verse of batch) {
      flexIndex.add(verse.id, verse.text)
    }
    indexed = Math.min(i + BATCH_SIZE, verses.length)
    self.postMessage({ type: 'PROGRESS', indexed, total } satisfies WorkerOutgoingMessage)
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }

  indexed = total
  self.postMessage({ type: 'INDEX_COMPLETE', total } satisfies WorkerOutgoingMessage)
}

function handleSearch(query: string, limit: number, id: number): void {
  if (!flexIndex) {
    self.postMessage({
      type: 'ERROR',
      message: 'Index not initialized'
    } satisfies WorkerOutgoingMessage)
    return
  }

  const tokens = jiebaReady ? cut(query, true) : [query]
  const joined = tokens.join(' ')
  const raw = flexIndex.search(joined, { limit })
  const results = raw.map((r) => (typeof r === 'number' ? r : Number(r)))
  self.postMessage({ type: 'SEARCH_RESULT', id, results } satisfies WorkerOutgoingMessage)
}

function handleGetProgress(id: number): void {
  self.postMessage({
    type: 'PROGRESS_RESULT',
    id,
    indexed,
    total
  } satisfies WorkerOutgoingMessage)
}

// ─── Message Handler ───────────────────────────────────────────────────────

self.onmessage = (event: MessageEvent<WorkerIncomingMessage>) => {
  const { data } = event
  switch (data.type) {
    case 'INIT':
      handleInit().catch((e) => {
        const message = e instanceof Error ? e.message : String(e)
        self.postMessage({ type: 'ERROR', message } satisfies WorkerOutgoingMessage)
      })
      break
    case 'BUILD_INDEX':
      handleBuildIndex(data.verses).catch((e) => {
        const message = e instanceof Error ? e.message : String(e)
        self.postMessage({ type: 'ERROR', message } satisfies WorkerOutgoingMessage)
      })
      break
    case 'SEARCH':
      handleSearch(data.query, data.limit ?? 20, data.id)
      break
    case 'GET_PROGRESS':
      handleGetProgress(data.id)
      break
  }
}
