import { app, BrowserWindow, dialog, ipcMain, protocol } from 'electron'
import { is } from '@electron-toolkit/utils'
import path from 'path'
import fs from 'fs'
import https from 'https'
import type { WindowManager } from '../windowManager'
import { isMainWindow } from './validate'
import type {
  WhisperModel,
  WhisperDownloadProgress,
  WhisperDirInfo
} from '../../shared/ipc-channels'

const HF_BASE = 'https://huggingface.co/onnx-community'

const WHISPER_FILES: Record<string, string[]> = {
  'whisper-base': [
    'config.json',
    'generation_config.json',
    'tokenizer.json',
    'tokenizer_config.json',
    'special_tokens_map.json',
    'normalizer.json',
    'preprocessor_config.json',
    'vocab.json',
    'merges.txt',
    'added_tokens.json',
    'onnx/encoder_model_quantized.onnx',
    'onnx/decoder_model_merged_quantized.onnx'
  ],
  'whisper-small': [
    'config.json',
    'generation_config.json',
    'tokenizer.json',
    'tokenizer_config.json',
    'special_tokens_map.json',
    'normalizer.json',
    'preprocessor_config.json',
    'vocab.json',
    'merges.txt',
    'added_tokens.json',
    'onnx/encoder_model_quantized.onnx',
    'onnx/decoder_model_merged_quantized.onnx'
  ],
  'whisper-medium': [
    'config.json',
    'generation_config.json',
    'tokenizer.json',
    'tokenizer_config.json',
    'special_tokens_map.json',
    'normalizer.json',
    'preprocessor_config.json',
    'vocab.json',
    'merges.txt',
    'added_tokens.json',
    'onnx/encoder_model_quantized.onnx',
    'onnx/decoder_model_merged_quantized.onnx'
  ]
}

function httpsHead(url: string): Promise<{ contentLength: number }> {
  return new Promise((resolve, reject) => {
    const request = (targetUrl: string): void => {
      const parsed = new URL(targetUrl)
      https
        .request(
          { hostname: parsed.hostname, path: parsed.pathname + parsed.search, method: 'HEAD' },
          (res) => {
            if (
              res.statusCode === 301 ||
              res.statusCode === 302 ||
              res.statusCode === 307 ||
              res.statusCode === 308
            ) {
              const location = res.headers.location
              if (location) {
                request(new URL(location, targetUrl).href)
                return
              }
            }
            const cl = res.headers['content-length']
            resolve({ contentLength: cl ? parseInt(cl, 10) : 0 })
          }
        )
        .on('error', reject)
        .end()
    }
    request(url)
  })
}

function downloadFile(
  url: string,
  destPath: string,
  onProgress: (bytes: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = (targetUrl: string): void => {
      https
        .get(targetUrl, (res) => {
          if (
            res.statusCode === 301 ||
            res.statusCode === 302 ||
            res.statusCode === 307 ||
            res.statusCode === 308
          ) {
            const location = res.headers.location
            if (location) {
              request(new URL(location, targetUrl).href)
              return
            }
          }
          if (!res.statusCode || res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} for ${targetUrl}`))
            return
          }
          const dir = path.dirname(destPath)
          fs.mkdirSync(dir, { recursive: true })
          const out = fs.createWriteStream(destPath)
          res.on('data', (chunk: Buffer) => {
            onProgress(chunk.length)
          })
          res.pipe(out)
          out.on('finish', resolve)
          out.on('error', reject)
          res.on('error', reject)
        })
        .on('error', reject)
    }
    request(url)
  })
}

let whisperModelDir: string | null = null

function detectInstalledModel(destDir: string): WhisperDirInfo {
  const whisperSubDir = path.join(destDir, 'whisper')
  if (!fs.existsSync(whisperSubDir)) return { hasFiles: false }
  const entries = fs.readdirSync(whisperSubDir)
  return { hasFiles: entries.length > 0 }
}

export function registerAppIpc(wm: WindowManager): void {
  ipcMain.handle('app:relaunch', (event) => {
    if (!isMainWindow(wm, event)) return
    if (is.dev) {
      const win = BrowserWindow.fromWebContents(event.sender)
      win?.webContents.reload()
    } else {
      app.relaunch()
      app.exit(0)
    }
  })

  ipcMain.handle('app:select-directory', async (event) => {
    if (!isMainWindow(wm, event)) return null
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('app:set-model-dir', (event, dir: string) => {
    if (!isMainWindow(wm, event)) return
    whisperModelDir = dir
  })

  ipcMain.handle('app:check-whisper-dir', (event, dir: string): WhisperDirInfo => {
    if (!isMainWindow(wm, event)) return { hasFiles: false }
    return detectInstalledModel(dir)
  })

  ipcMain.handle(
    'app:download-whisper-model',
    async (event, model: WhisperModel, destDir: string) => {
      if (!isMainWindow(wm, event)) return
      const sender = event.sender

      const files = WHISPER_FILES[model]
      if (!files) throw new Error(`Unknown model: ${model}`)

      const modelSubDir = path.join(destDir, 'whisper')

      const sendProgress = (progress: WhisperDownloadProgress): void => {
        if (!sender.isDestroyed()) sender.send('app:download-progress', progress)
      }

      const fileSizes: number[] = []
      for (const file of files) {
        const destPath = path.join(modelSubDir, file)
        if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
          fileSizes.push(0)
        } else {
          try {
            const url = `${HF_BASE}/${model}/resolve/main/${file}`
            const { contentLength } = await httpsHead(url)
            fileSizes.push(contentLength)
          } catch {
            fileSizes.push(0)
          }
        }
      }

      const totalBytes = fileSizes.reduce((a, b) => a + b, 0)
      let downloadedBytes = 0

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const destPath = path.join(modelSubDir, file)

        if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
          sendProgress({
            model,
            percent: totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 100,
            currentFile: file,
            done: false
          })
          continue
        }

        const url = `${HF_BASE}/${model}/resolve/main/${file}`
        sendProgress({
          model,
          percent: totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0,
          currentFile: file,
          done: false
        })

        try {
          await downloadFile(url, destPath, (bytes) => {
            downloadedBytes += bytes
            const percent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0
            sendProgress({ model, percent, currentFile: file, done: false })
          })
        } catch (err) {
          sendProgress({ model, percent: 0, currentFile: file, done: false, error: String(err) })
          throw err
        }
      }

      whisperModelDir = destDir
      sendProgress({ model, percent: 100, currentFile: '', done: true })
    }
  )
}

export function registerLocalModelProtocol(): void {
  protocol.handle('local-model', (request) => {
    if (!whisperModelDir) return new Response('Model dir not set', { status: 503 })
    const url = new URL(request.url)
    const filePath = path.join(whisperModelDir, url.pathname)
    try {
      const data = fs.readFileSync(filePath)
      return new Response(data)
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}
