import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { importPptxSlideDocument } from '../slide-pptx-import'

async function makePptx(slides: string[]): Promise<ArrayBuffer> {
  const zip = new JSZip()
  slides.forEach((text, index) => {
    zip.file(
      `ppt/slides/slide${index + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <p:cSld>
          <p:spTree>
            <p:sp>
              <p:txBody>
                <a:p><a:r><a:t>${text}</a:t></a:r></a:p>
              </p:txBody>
            </p:sp>
          </p:spTree>
        </p:cSld>
      </p:sld>`
    )
  })
  return zip.generateAsync({ type: 'arraybuffer' })
}

describe('importPptxSlideDocument', () => {
  it('imports pptx slide text into a native slide document', async () => {
    const input = await makePptx(['Welcome', 'Amazing Grace'])

    const document = await importPptxSlideDocument(input, { title: 'Imported Deck' })

    expect(document.title).toBe('Imported Deck')
    expect(document.slides).toHaveLength(2)
    expect(document.slides[0].elements[0]).toMatchObject({
      type: 'text',
      text: 'Welcome'
    })
    expect(document.slides[1].elements[0]).toMatchObject({
      type: 'text',
      text: 'Amazing Grace'
    })
  })

  it('rejects files without ppt slides', async () => {
    const zip = new JSZip()
    zip.file('doc.txt', 'not a deck')
    const input = await zip.generateAsync({ type: 'arraybuffer' })

    await expect(importPptxSlideDocument(input)).rejects.toThrow('No slides found')
  })
})
