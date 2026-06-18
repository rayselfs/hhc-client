import { describe, expect, it } from 'vitest'
import {
  canGenerateMediaThumbnail,
  classifyFile,
  getMediaFileAcceptAttribute,
  getFileExtension,
  getMediaSupport,
  resolveMediaCapability,
  validateMediaCapabilityRegistry
} from '../media-capabilities'

describe('media capability registry', () => {
  it('has no duplicate MIME or extension registrations', () => {
    expect(() => validateMediaCapabilityRegistry()).not.toThrow()
  })

  it.each([
    ['image/jpg', undefined, 'image/jpeg', 'native'],
    ['VIDEO/MP4; codecs=avc1', undefined, 'video/mp4', 'native'],
    ['', 'slides.PDF', 'application/pdf', 'native'],
    ['application/octet-stream', 'movie.MKV', 'video/x-matroska', 'unsupported'],
    ['', 'movie.wmv', 'video/x-ms-wmv', 'unsupported']
  ])(
    'resolves MIME %s and file %s consistently',
    (mimeType, fileName, canonicalMimeType, expectedSupport) => {
      const capability = resolveMediaCapability({ mimeType, fileName })
      expect(capability?.canonicalMimeType).toBe(canonicalMimeType)
      expect(capability && getMediaSupport(capability, 'web')).toBe(expectedSupport)
    }
  )

  it('keeps desktop-engine video formats Electron-only', () => {
    const capability = resolveMediaCapability({ mimeType: '', fileName: 'movie.mkv' })

    expect(capability?.canonicalMimeType).toBe('video/x-matroska')
    expect(capability && getMediaSupport(capability, 'web')).toBe('unsupported')
    expect(capability && getMediaSupport(capability, 'electron')).toBe('desktop-engine')
  })

  it('prefers recognized MIME over a conflicting extension', () => {
    const capability = resolveMediaCapability({
      mimeType: 'image/png',
      fileName: 'not-really-a-video.mkv'
    })
    expect(capability?.canonicalMimeType).toBe('image/png')
  })

  it('keeps unknown image MIME compatible while rejecting unknown video MIME', () => {
    const image = resolveMediaCapability({ mimeType: 'image/avif' })
    const video = resolveMediaCapability({ mimeType: 'video/unknown' })

    expect(image?.kind).toBe('image')
    expect(image && getMediaSupport(image, 'electron')).toBe('native')
    expect(video?.kind).toBe('video')
    expect(video && getMediaSupport(video, 'electron')).toBe('unsupported')
  })

  it('derives thumbnail strategy from the same capability', () => {
    expect(canGenerateMediaThumbnail(resolveMediaCapability({ mimeType: 'application/pdf' }))).toBe(
      true
    )
    expect(
      canGenerateMediaThumbnail(resolveMediaCapability({ mimeType: 'video/x-matroska' }))
    ).toBe(false)
  })

  it.each([
    ['photo.JPG', 'jpg'],
    ['archive.tar.gz', 'gz'],
    ['.env', ''],
    ['no-extension', '']
  ])('extracts extension from %s', (fileName, expected) => {
    expect(getFileExtension(fileName)).toBe(expected)
  })

  it.each([
    ['slides.PDF', '', 'pdf', 'application/pdf', 'native'],
    ['photo.PNG', 'application/octet-stream', 'image', 'image/png', 'native'],
    ['movie.MP4', '', 'video', 'video/mp4', 'native'],
    ['movie.mkv', '', 'unsupported', 'video/x-matroska', 'unsupported'],
    ['movie.mpg', '', 'unsupported', 'video/mpeg', 'unsupported'],
    ['movie.bin', 'video/unknown', 'unsupported', 'video/unknown', 'unsupported'],
    ['notes.txt', '', 'unsupported', 'application/octet-stream', 'unsupported']
  ])('classifies %s with MIME %s for Web', (name, type, kind, mimeType, support) => {
    expect(classifyFile({ name, type }, 'web')).toEqual({
      kind,
      mimeType,
      extension: getFileExtension(name),
      support
    })
  })

  it('classifies desktop-engine video for Electron upload', () => {
    expect(classifyFile({ name: 'movie.mkv', type: '' }, 'electron')).toEqual({
      kind: 'video',
      mimeType: 'video/x-matroska',
      extension: 'mkv',
      support: 'desktop-engine'
    })
  })

  it('derives the Web file input filter from native browser capabilities only', () => {
    const accept = getMediaFileAcceptAttribute('web')
    expect(accept).toContain('image/*')
    expect(accept).toContain('.pdf')
    expect(accept).toContain('.mp4')
    expect(accept).not.toContain('video/*')
    expect(accept).not.toContain('.mkv')
    expect(accept).not.toContain('.pptx')
    expect(accept).not.toContain('.mpg')
  })

  it('derives the Electron file input filter with desktop video engine candidates', () => {
    const accept = getMediaFileAcceptAttribute('electron')
    expect(accept).toContain('image/*')
    expect(accept).toContain('.pdf')
    expect(accept).toContain('.mkv')
    expect(accept).not.toContain('video/*')
    expect(accept).not.toContain('.pptx')
    expect(accept).not.toContain('.mpg')
  })
})
