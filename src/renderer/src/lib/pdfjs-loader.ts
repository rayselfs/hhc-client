export async function loadPdfjsLib(): Promise<typeof import('pdfjs-dist')> {
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

  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).href
  return pdfjsLib
}
