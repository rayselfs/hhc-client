import { spawn } from 'child_process'

export interface RunFfmpegOptions {
  executable: string
  args: string[]
  timeoutMs: number
  signal?: AbortSignal
  maxOutputBytes?: number
}

export function runFfmpegProcess({
  executable,
  args,
  timeoutMs,
  signal,
  maxOutputBytes = 64 * 1024
}: RunFfmpegOptions): Promise<{ stdout: string; stderr: string }> {
  if (signal?.aborted) return Promise.reject(new Error('FFmpeg process aborted'))

  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout: Buffer = Buffer.alloc(0)
    let stderr: Buffer = Buffer.alloc(0)
    let failure: Error | null = null

    const append = (current: Buffer, chunk: Buffer): Buffer => {
      const remaining = maxOutputBytes - current.length
      return remaining > 0 ? Buffer.concat([current, chunk.subarray(0, remaining)]) : current
    }
    const terminate = (error: Error): void => {
      failure ??= error
      child.kill()
    }
    const onAbort = (): void => terminate(new Error('FFmpeg process aborted'))
    const timeout = setTimeout(() => terminate(new Error('FFmpeg process timed out')), timeoutMs)

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout = append(stdout, chunk)
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = append(stderr, chunk)
    })
    child.on('error', (error) => {
      failure ??= error
    })
    child.on('close', (code) => {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
      if (failure) {
        reject(failure)
        return
      }
      const result = { stdout: stdout.toString('utf8'), stderr: stderr.toString('utf8') }
      if (code === 0) resolve(result)
      else {
        reject(
          new Error(
            result.stderr.trim() ||
              result.stdout.trim() ||
              `FFmpeg exited with code ${code ?? 'unknown'}`
          )
        )
      }
    })
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
