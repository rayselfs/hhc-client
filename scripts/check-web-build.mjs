import { readFileSync } from 'node:fs'

const html = readFileSync('out/renderer/index.html', 'utf8')
const localAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((path) => path && !/^(?:[a-z]+:|#)/i.test(path))
const relativeAssets = localAssets.filter((path) => !path.startsWith('/'))

if (relativeAssets.length) {
  throw new Error(`Hosted renderer contains relative assets: ${relativeAssets.join(', ')}`)
}
