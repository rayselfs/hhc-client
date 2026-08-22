import { describe, expect, it } from 'vitest'
import { getLanRemoteMobileHtml } from '../lan-remote/mobile-ui'

describe('LAN remote mobile UI', () => {
  it('schedules the next state refresh only after the current request settles', () => {
    const html = getLanRemoteMobileHtml()

    expect(html).toContain('async function pollState()')
    expect(html).toContain('await refreshState()')
    expect(html).toContain('setTimeout(pollState, 1000)')
    expect(html).not.toContain('setInterval(')
  })
})
