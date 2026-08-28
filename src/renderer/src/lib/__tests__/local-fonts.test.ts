import { describe, expect, it, vi } from 'vitest'
import { mergeFontFamilies, queryLocalFontFamilies, supportsLocalFontAccess } from '../local-fonts'

describe('local fonts', () => {
  it('reports unsupported environments without querying', async () => {
    expect(supportsLocalFontAccess({})).toBe(false)
    await expect(queryLocalFontFamilies({})).resolves.toEqual([])
  })

  it('returns unique sorted font family names', async () => {
    const queryLocalFonts = vi
      .fn()
      .mockResolvedValue([
        { family: 'Songti TC' },
        { family: ' BiauKaiTC ' },
        { family: '' },
        { family: 'Songti TC' },
        { family: 'BiauKaiTC' }
      ])

    await expect(queryLocalFontFamilies({ queryLocalFonts })).resolves.toEqual([
      'BiauKaiTC',
      'Songti TC'
    ])
    expect(queryLocalFonts).toHaveBeenCalledOnce()
  })

  it('caches a successful installed-family query for the module lifetime', async () => {
    vi.resetModules()
    const { queryLocalFontFamiliesOnce } = await import('../local-fonts')
    const queryLocalFonts = vi.fn().mockResolvedValue([{ family: 'DFKai-SB' }])
    const access = { queryLocalFonts }

    await expect(queryLocalFontFamiliesOnce(access)).resolves.toEqual(['DFKai-SB'])
    await expect(queryLocalFontFamiliesOnce(access)).resolves.toEqual(['DFKai-SB'])

    expect(queryLocalFonts).toHaveBeenCalledOnce()
  })

  it('retries an installed-family query after a rejection', async () => {
    vi.resetModules()
    const { queryLocalFontFamiliesOnce } = await import('../local-fonts')
    const queryLocalFonts = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'))
      .mockResolvedValueOnce([{ family: 'PMingLiU' }])
    const access = { queryLocalFonts }

    await expect(queryLocalFontFamiliesOnce(access)).rejects.toMatchObject({
      name: 'NotAllowedError'
    })
    await expect(queryLocalFontFamiliesOnce(access)).resolves.toEqual(['PMingLiU'])

    expect(queryLocalFonts).toHaveBeenCalledTimes(2)
  })

  it('merges groups once while preserving their display order', () => {
    expect(
      mergeFontFamilies(['Inter Variable', 'Arial'], ['Aptos'], ['Arial', 'PingFang TC'])
    ).toEqual(['Inter Variable', 'Arial', 'Aptos', 'PingFang TC'])
  })
})
