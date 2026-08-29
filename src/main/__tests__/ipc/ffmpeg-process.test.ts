import { EventEmitter } from 'events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSpawn } = vi.hoisted(() => ({ mockSpawn: vi.fn() }))

vi.mock('child_process', () => ({
  spawn: mockSpawn,
  default: { spawn: mockSpawn }
}))

import { runFfmpegProcess } from '../../ipc/ffmpeg-process'

function processDouble(): EventEmitter & {
  stdout: EventEmitter
  stderr: EventEmitter
  kill: ReturnType<typeof vi.fn>
} {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter
    stderr: EventEmitter
    kill: ReturnType<typeof vi.fn>
  }
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.kill = vi.fn()
  mockSpawn.mockReturnValueOnce(child)
  return child
}

beforeEach(() => vi.clearAllMocks())

describe('runFfmpegProcess', () => {
  it('spawns hidden without a shell and returns bounded output', async () => {
    const child = processDouble()
    const result = runFfmpegProcess({
      executable: '/runtime/ffmpeg',
      args: ['-version'],
      timeoutMs: 1000,
      maxOutputBytes: 4
    })

    child.stdout.emit('data', Buffer.from('stdout'))
    child.stderr.emit('data', Buffer.from('stderr'))
    child.emit('close', 0)

    await expect(result).resolves.toEqual({ stdout: 'stdo', stderr: 'stde' })
    expect(mockSpawn).toHaveBeenCalledWith('/runtime/ffmpeg', ['-version'], {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
  })

  it('waits for close before rejecting a spawn error', async () => {
    const child = processDouble()
    const result = runFfmpegProcess({ executable: 'ffmpeg', args: [], timeoutMs: 1000 })
    let settled = false
    void result.catch(() => {
      settled = true
    })

    child.emit('error', new Error('spawn failed'))
    await Promise.resolve()
    expect(settled).toBe(false)
    child.emit('close', null)
    await expect(result).rejects.toThrow('spawn failed')
  })

  it('uses stderr for a non-zero exit', async () => {
    const child = processDouble()
    const result = runFfmpegProcess({ executable: 'ffmpeg', args: [], timeoutMs: 1000 })
    child.stderr.emit('data', Buffer.from('decode failed'))
    child.emit('close', 1)
    await expect(result).rejects.toThrow('decode failed')
  })

  it('kills on timeout and waits for close', async () => {
    vi.useFakeTimers()
    try {
      const child = processDouble()
      const result = runFfmpegProcess({ executable: 'ffmpeg', args: [], timeoutMs: 15 })
      let settled = false
      void result.catch(() => {
        settled = true
      })

      await vi.advanceTimersByTimeAsync(15)
      expect(child.kill).toHaveBeenCalledOnce()
      expect(settled).toBe(false)
      child.emit('close', null)
      await expect(result).rejects.toThrow('timed out')
    } finally {
      vi.useRealTimers()
    }
  })

  it('kills on abort and waits for close', async () => {
    const child = processDouble()
    const controller = new AbortController()
    const result = runFfmpegProcess({
      executable: 'ffmpeg',
      args: [],
      timeoutMs: 1000,
      signal: controller.signal
    })
    let settled = false
    void result.catch(() => {
      settled = true
    })

    controller.abort()
    await Promise.resolve()
    expect(child.kill).toHaveBeenCalledOnce()
    expect(settled).toBe(false)
    child.emit('close', null)
    await expect(result).rejects.toThrow('aborted')
  })
})
