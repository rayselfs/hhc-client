import { Index } from 'flexsearch'

export type WorkerIncomingMessage =
  | { type: 'INIT' }
  | { type: 'BUILD_INDEX'; verses: { id: number; text: string }[] }
  | {
      type: 'BUILD_CACHE_ONLY'
      verses: { id: number; text: string }[]
    }
  | { type: 'LOAD_INDEX'; chunks: { key: string; data: string }[] }
  | { type: 'EXPORT_INDEX' }
  | { type: 'SEARCH'; query: string; limit?: number; id: number }
  | { type: 'GET_PROGRESS'; id: number }

export type WorkerOutgoingMessage =
  | { type: 'READY' }
  | { type: 'INDEX_COMPLETE'; total: number }
  | { type: 'INDEX_LOADED' }
  | { type: 'INDEX_EXPORTED'; chunks: { key: string; data: string }[] }
  | { type: 'CACHE_BUILT'; chunks: { key: string; data: string }[] }
  | { type: 'PROGRESS'; indexed: number; total: number }
  | { type: 'SEARCH_RESULT'; id: number; results: number[] }
  | { type: 'PROGRESS_RESULT'; id: number; indexed: number; total: number }
  | { type: 'ERROR'; message: string }

const BATCH_SIZE = 1000

let flexIndex: Index | null = null
let indexed = 0
let total = 0

// CJK Unicode ranges: CJK Unified Ideographs + Extension A + CJK Compat Ideographs
const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/

/**
 * Character-level CJK encoder for FlexSearch.
 * - CJK characters: split into individual characters
 * - Non-CJK (Latin, digits, etc.): keep as space-separated words
 * This ensures any substring of CJK text is searchable via `tokenize: 'forward'`.
 */
function cjkCharEncode(text: string): string[] {
  const tokens: string[] = []
  let latinBuf = ''

  for (const ch of text) {
    if (CJK_RE.test(ch)) {
      if (latinBuf) {
        tokens.push(latinBuf)
        latinBuf = ''
      }
      tokens.push(ch)
    } else if (/\s/.test(ch)) {
      if (latinBuf) {
        tokens.push(latinBuf)
        latinBuf = ''
      }
    } else {
      latinBuf += ch.toLowerCase()
    }
  }
  if (latinBuf) tokens.push(latinBuf)

  return tokens
}

function createIndex(): Index {
  return new Index({ encode: cjkCharEncode, tokenize: 'forward' })
}

function handleInit(): void {
  try {
    flexIndex = createIndex()
    self.postMessage({ type: 'READY' } satisfies WorkerOutgoingMessage)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    self.postMessage({ type: 'ERROR', message } satisfies WorkerOutgoingMessage)
  }
}

async function buildIntoIndex(
  target: Index,
  verses: { id: number; text: string }[]
): Promise<void> {
  total = verses.length
  indexed = 0
  target.clear()

  for (let i = 0; i < verses.length; i += BATCH_SIZE) {
    const batch = verses.slice(i, i + BATCH_SIZE)
    for (const verse of batch) {
      target.add(verse.id, verse.text)
    }
    indexed = Math.min(i + BATCH_SIZE, verses.length)
    self.postMessage({ type: 'PROGRESS', indexed, total } satisfies WorkerOutgoingMessage)
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  indexed = total
}

async function handleBuildIndex(verses: { id: number; text: string }[]): Promise<void> {
  if (!flexIndex) {
    self.postMessage({
      type: 'ERROR',
      message: 'Index not initialized'
    } satisfies WorkerOutgoingMessage)
    return
  }

  await buildIntoIndex(flexIndex, verses)
  self.postMessage({ type: 'INDEX_COMPLETE', total } satisfies WorkerOutgoingMessage)
}

async function handleBuildCacheOnly(verses: { id: number; text: string }[]): Promise<void> {
  const tempIndex = createIndex()
  await buildIntoIndex(tempIndex, verses)

  const chunks: { key: string; data: string }[] = []
  await tempIndex.export((key: string, data: string) => {
    if (data) chunks.push({ key, data })
  })
  self.postMessage({ type: 'CACHE_BUILT', chunks } satisfies WorkerOutgoingMessage)
}

function handleLoadIndex(chunks: { key: string; data: string }[]): void {
  if (!flexIndex) {
    self.postMessage({
      type: 'ERROR',
      message: 'Index not initialized'
    } satisfies WorkerOutgoingMessage)
    return
  }

  flexIndex.clear()
  for (const chunk of chunks) {
    flexIndex.import(chunk.key, chunk.data)
  }
  self.postMessage({ type: 'INDEX_LOADED' } satisfies WorkerOutgoingMessage)
}

async function handleExportIndex(): Promise<void> {
  if (!flexIndex) {
    self.postMessage({
      type: 'ERROR',
      message: 'Index not initialized'
    } satisfies WorkerOutgoingMessage)
    return
  }

  const chunks: { key: string; data: string }[] = []
  await flexIndex.export((key: string, data: string) => {
    if (data) chunks.push({ key, data })
  })
  self.postMessage({ type: 'INDEX_EXPORTED', chunks } satisfies WorkerOutgoingMessage)
}

function handleSearch(query: string, limit: number, id: number): void {
  if (!flexIndex) {
    self.postMessage({
      type: 'ERROR',
      message: 'Index not initialized'
    } satisfies WorkerOutgoingMessage)
    return
  }

  const tokens = cjkCharEncode(query)
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

type QueuedTask = () => Promise<void>
const taskQueue: QueuedTask[] = []
let processing = false

async function processQueue(): Promise<void> {
  if (processing) return
  processing = true
  while (taskQueue.length > 0) {
    const task = taskQueue.shift()!
    try {
      await task()
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      self.postMessage({ type: 'ERROR', message } satisfies WorkerOutgoingMessage)
    }
  }
  processing = false
}

function enqueue(task: QueuedTask): void {
  taskQueue.push(task)
  processQueue()
}

self.onmessage = (event: MessageEvent<WorkerIncomingMessage>) => {
  const { data } = event
  switch (data.type) {
    case 'INIT':
      enqueue(() => Promise.resolve(handleInit()))
      break
    case 'BUILD_INDEX':
      enqueue(() => handleBuildIndex(data.verses))
      break
    case 'BUILD_CACHE_ONLY':
      enqueue(() => handleBuildCacheOnly(data.verses))
      break
    case 'LOAD_INDEX':
      enqueue(() => Promise.resolve(handleLoadIndex(data.chunks)))
      break
    case 'EXPORT_INDEX':
      enqueue(() => handleExportIndex())
      break
    case 'SEARCH':
      handleSearch(data.query, data.limit ?? 20, data.id)
      break
    case 'GET_PROGRESS':
      handleGetProgress(data.id)
      break
  }
}
