import {
  addElementToSlide,
  createTextElement,
  createBlankEditablePresentationDocument
} from '../editable-presentation'
import { describe, expect, it, vi } from 'vitest'
import {
  findUnavailablePresentationFonts,
  getDocumentFontFamilies,
  mergeFontFamilies,
  queryLocalFontFamilies,
  supportsLocalFontAccess
} from '../local-fonts'

describe('local fonts', () => {
  it('includes document run fonts even when they differ from the box default', () => {
    const document = createBlankEditablePresentationDocument('Fonts')
    const element = createTextElement({
      text: 'Hello',
      fontFamily: 'Arial',
      runs: [{ ...createTextElement(), text: 'Hello', fontFamily: 'Unavailable Family' }]
    })
    expect(
      getDocumentFontFamilies(addElementToSlide(document, document.slideOrder[0], element))
    ).toEqual(['Arial', 'Unavailable Family'])
  })

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

it('reports only font families that match both fallback measurements', async () => {
  const context = {
    font: '',
    measureText: () => ({
      width: context.font.includes('Installed Family')
        ? 300
        : context.font.endsWith('monospace')
          ? 100
          : 200
    })
  }
  const spy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(() => context as unknown as CanvasRenderingContext2D)
  try {
    await expect(
      findUnavailablePresentationFonts(['Installed Family', 'Missing Family'])
    ).resolves.toEqual(['Missing Family'])
  } finally {
    spy.mockRestore()
  }
})
