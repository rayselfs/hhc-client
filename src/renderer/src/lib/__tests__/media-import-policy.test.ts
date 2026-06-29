import { describe, expect, it } from 'vitest'
import { classifyMediaImport } from '../media-import-policy'

describe('classifyMediaImport', () => {
  it('skips system files', () => {
    expect(classifyMediaImport({ name: '.DS_Store' }, 'electron')).toMatchObject({
      action: 'skip',
      reason: 'system-file'
    })
  })

  it('skips app-unsupported files even when they report an image MIME type', () => {
    expect(
      classifyMediaImport({ name: 'layout.psd', mimeType: 'image/vnd.adobe.photoshop' }, 'web')
    ).toMatchObject({
      action: 'skip',
      reason: 'app-unsupported',
      extension: 'psd'
    })
  })

  it('accepts cross-platform media', () => {
    expect(classifyMediaImport({ name: 'slide.png' }, 'web')).toMatchObject({
      action: 'accept',
      kind: 'image',
      mimeType: 'image/png',
      support: 'native'
    })
    expect(classifyMediaImport({ name: 'slide.png' }, 'electron')).toMatchObject({
      action: 'accept',
      kind: 'image',
      mimeType: 'image/png',
      support: 'native'
    })
  })

  it('keeps known desktop-only media as platform unsupported on Web', () => {
    expect(classifyMediaImport({ name: 'legacy.avi' }, 'web')).toMatchObject({
      action: 'platform-unsupported',
      kind: 'video',
      mimeType: 'video/x-msvideo',
      support: 'unsupported'
    })
  })

  it('accepts known desktop media in Electron', () => {
    expect(classifyMediaImport({ name: 'legacy.avi' }, 'electron')).toMatchObject({
      action: 'accept',
      kind: 'video',
      mimeType: 'video/x-msvideo',
      support: 'desktop-engine'
    })
  })

  it('accepts PPTX as a presentation media item', () => {
    expect(classifyMediaImport({ name: 'slides.pptx' }, 'web')).toMatchObject({
      action: 'accept',
      kind: 'presentation',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      support: 'native'
    })
  })

  it('skips known formats that no platform supports', () => {
    expect(classifyMediaImport({ name: 'legacy.mpg' }, 'electron')).toMatchObject({
      action: 'skip',
      reason: 'app-unsupported',
      extension: 'mpg'
    })
  })

  it('accepts MKV as a Web candidate', () => {
    expect(classifyMediaImport({ name: 'message.mkv' }, 'web')).toMatchObject({
      action: 'accept',
      kind: 'video',
      mimeType: 'video/x-matroska',
      support: 'native'
    })
  })
})
