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
    ['application/octet-stream', 'movie.MKV', 'video/x-matroska', 'transcode-required'],
    ['', 'movie.wmv', 'video/x-ms-wmv', 'transcode-required']
  ])(
    'resolves MIME %s and file %s consistently',
    (mimeType, fileName, canonicalMimeType, expectedSupport) => {
      const capability = resolveMediaCapability({ mimeType, fileName })
      expect(capability?.canonicalMimeType).toBe(canonicalMimeType)
      expect(capability && getMediaSupport(capability, 'web')).toBe(expectedSupport)
    }
  )

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
    ['slides.PDF', '', 'pdf', 'application/pdf'],
    ['photo.PNG', 'application/octet-stream', 'image', 'image/png'],
    ['movie.MP4', '', 'video', 'video/mp4'],
    ['movie.mkv', '', 'video', 'video/x-matroska'],
    ['movie.mpg', '', 'unsupported', 'video/mpeg'],
    ['movie.bin', 'video/unknown', 'unsupported', 'video/unknown'],
    ['notes.txt', '', 'unsupported', 'application/octet-stream']
  ])('classifies %s with MIME %s', (name, type, kind, mimeType) => {
    expect(classifyFile({ name, type })).toEqual({
      kind,
      mimeType,
      extension: getFileExtension(name)
    })
  })

  it('derives the file input filter from registered capabilities', () => {
    const accept = getMediaFileAcceptAttribute()
    expect(accept).toContain('image/*')
    expect(accept).toContain('.pdf')
    expect(accept).toContain('.mkv')
    expect(accept).toContain('.pptx')
    expect(accept).not.toContain('.mpg')
  })
})
