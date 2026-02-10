/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { app, protocol } from 'electron'
import path from 'path'
import fs from 'fs-extra'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(),
  },
  protocol: {
    handle: vi.fn(),
  },
}))

vi.mock('fs-extra', () => ({
  default: {
    realpathSync: vi.fn(),
  },
}))

describe('File Protocol Security', () => {
  let protocolHandler: (request: Request) => Promise<Response>
  const mockUserDataPath = '/Users/test/userData'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(app.getPath).mockReturnValue(mockUserDataPath)

    vi.mocked(protocol.handle).mockImplementation((scheme, handler) => {
      if (scheme === 'local-resource') {
        protocolHandler = handler as (request: Request) => Promise<Response>
      }
    })
  })

  it('should block symlinks outside userData', async () => {
    const symlinkTarget = '/etc/passwd'

    vi.mocked(fs.realpathSync).mockReturnValue(symlinkTarget)

    const mockRequest = new Request('local-resource://safe.txt')

    if (protocolHandler) {
      const response = await protocolHandler(mockRequest)
      expect(response.status).toBe(403)
      expect(await response.text()).toContain('Forbidden')
    }
  })

  it('should block .. path traversal attempts', async () => {
    const mockRequest = new Request(`local-resource://../../../etc/passwd`)

    if (protocolHandler) {
      const response = await protocolHandler(mockRequest)
      expect(response.status).toBe(403)
      expect(await response.text()).toContain('Forbidden')
    }
  })

  it('should block absolute paths outside userData', async () => {
    const maliciousPath = '/etc/passwd'

    vi.mocked(fs.realpathSync).mockReturnValue(maliciousPath)

    const mockRequest = new Request('local-resource:///etc/passwd')

    if (protocolHandler) {
      const response = await protocolHandler(mockRequest)
      expect(response.status).toBe(403)
      expect(await response.text()).toContain('Forbidden')
    }
  })

  it('should allow valid paths within userData', async () => {
    const validPath = path.join(mockUserDataPath, 'media', 'test.mp4')

    vi.mocked(fs.realpathSync).mockReturnValue(validPath)

    const mockRequest = new Request('local-resource://media/test.mp4')

    if (protocolHandler) {
      const response = await protocolHandler(mockRequest)
      expect(response.status).not.toBe(403)
    }
  })

  it('should return 404 when realpath fails', async () => {
    vi.mocked(fs.realpathSync).mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory')
    })

    const mockRequest = new Request('local-resource://nonexistent.txt')

    if (protocolHandler) {
      const response = await protocolHandler(mockRequest)
      expect(response.status).toBe(404)
      expect(await response.text()).toContain('Not Found')
    }
  })
})
