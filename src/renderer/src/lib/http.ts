import _camelcaseKeys from 'camelcase-keys'

const camelcaseKeys =
  (_camelcaseKeys as unknown as { default: typeof _camelcaseKeys }).default ?? _camelcaseKeys
const DEFAULT_TIMEOUT_MS = 30_000

export const http = {
  async get<T>(url: string, options: { timeout?: number } = {}): Promise<{ data: T }> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? DEFAULT_TIMEOUT_MS)

    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) {
        const detail = response.statusText ? `: ${response.statusText}` : ''
        throw new Error(`HTTP ${response.status}${detail}`)
      }

      const parsed = JSON.parse(await response.text()) as Parameters<typeof camelcaseKeys>[0]
      return { data: camelcaseKeys(parsed, { deep: true }) as T }
    } finally {
      clearTimeout(timeoutId)
    }
  }
}
