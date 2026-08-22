// Polyfill Map.prototype.getOrInsertComputed and Math.sumPrecise
// before the pdfjs worker bundle executes.
//
// IMPORTANT: dynamic import (not static) is intentional here.
// Static `import` statements are hoisted in ESM and would cause the
// pdfjs worker to run before our polyfills. `await import(...)` preserves
// top-level execution order so polyfills are in place first.

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

await import('pdfjs-dist/build/pdf.worker.mjs')

export {}
