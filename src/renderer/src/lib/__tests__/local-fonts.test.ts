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

  it('merges groups once while preserving their display order', () => {
    expect(
      mergeFontFamilies(['Inter Variable', 'Arial'], ['Aptos'], ['Arial', 'PingFang TC'])
    ).toEqual(['Inter Variable', 'Arial', 'Aptos', 'PingFang TC'])
  })
})
