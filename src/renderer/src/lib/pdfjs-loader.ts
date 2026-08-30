import pdfWorkerUrl from './pdf-worker-polyfill.worker.ts?worker&url'

function installPdfjsPolyfills(): void {
  if (!('getOrInsertComputed' in Map.prototype)) {
    Object.defineProperty(Map.prototype, 'getOrInsertComputed', {
      value<K, V>(this: Map<K, V>, key: K, factory: (key: K) => V): V {
        if (!this.has(key)) this.set(key, factory(key))
        return this.get(key)!
      },
      configurable: true,
      writable: true
    })
  }

  if (!('sumPrecise' in Math)) {
    Object.defineProperty(Math, 'sumPrecise', {
      value(iter: Iterable<number>): number {
        let sum = 0
        for (const n of iter) sum += n
        return sum
      },
      configurable: true,
      writable: true
    })
  }
}

export async function loadPdfjsLib(): Promise<typeof import('pdfjs-dist')> {
  installPdfjsPolyfills()

  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  return pdfjsLib
}

export async function loadPdfjsWorkerLib(): Promise<typeof import('pdfjs-dist')> {
  installPdfjsPolyfills()

  const pdfjsLib = await import('pdfjs-dist')
  const { WorkerMessageHandler } = await import('pdfjs-dist/build/pdf.worker.mjs')
  Object.assign(globalThis, { pdfjsWorker: { WorkerMessageHandler } })
  return pdfjsLib
}
