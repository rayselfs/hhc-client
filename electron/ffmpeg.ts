/**
 * FFmpeg Utilities for Electron
 *
 * User-provided FFmpeg strategy:
 * - Detects system-installed FFmpeg (via PATH)
 * - Supports custom user-provided path
 * - No bundled binaries
 */

import { spawn, execSync } from 'child_process'
import { existsSync, accessSync, constants } from 'fs'
import { app } from 'electron'
import { appSettings } from './appSettings'
import type { VideoQuality } from './appSettings'

export interface FFmpegStatus {
  available: boolean
  path: string
  version: string
  error?: string
}

export function getCommonFFmpegArgs(): string[] {
  const isDev = !app.isPackaged
  const args = ['-hide_banner']

  if (isDev) {
    args.push('-loglevel', 'warning', '-stats')
  } else {
    args.push('-loglevel', 'error', '-nostats', '-y', '-nostdin')
  }

  return args
}

let cachedFFmpegPath: string | null = null
let cachedFFprobePath: string | null = null

function findSystemBinary(name: string): string | null {
  try {
    if (process.platform === 'win32') {
      const result = execSync(`where ${name}`, { encoding: 'utf-8', timeout: 5000 }).trim()
      return result.split('\n')[0] || null
    } else {
      const result = execSync(`which ${name}`, { encoding: 'utf-8', timeout: 5000 }).trim()
      return result || null
    }
  } catch {
    return null
  }
}

function getFFmpegVersion(ffmpegPath: string): string {
  try {
    const result = execSync(`"${ffmpegPath}" -version`, { encoding: 'utf-8', timeout: 5000 })
    const match = result.match(/ffmpeg version (\S+)/)
    return match ? match[1] : 'unknown'
  } catch {
    return 'unknown'
  }
}

function validateBinaryPath(binaryPath: string): boolean {
  if (!binaryPath || !existsSync(binaryPath)) return false

  try {
    accessSync(binaryPath, constants.X_OK)
  } catch {
    return false
  }

  try {
    execSync(`"${binaryPath}" -version`, { encoding: 'utf-8', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

export function getFFmpegPath(): string {
  if (cachedFFmpegPath) return cachedFFmpegPath

  const customPath = appSettings.get('customFfmpegPath', '')
  if (customPath && validateBinaryPath(customPath)) {
    cachedFFmpegPath = customPath
    return customPath
  }

  const systemPath = findSystemBinary('ffmpeg')
  if (systemPath) {
    cachedFFmpegPath = systemPath
    return systemPath
  }

  return ''
}

export function getFFprobePath(): string {
  if (cachedFFprobePath) return cachedFFprobePath

  const customFfmpegPath = appSettings.get('customFfmpegPath', '')
  if (customFfmpegPath) {
    const ffprobePath = customFfmpegPath.replace(/ffmpeg(\.exe)?$/i, (match) =>
      match.toLowerCase().includes('.exe') ? 'ffprobe.exe' : 'ffprobe',
    )
    if (validateBinaryPath(ffprobePath)) {
      cachedFFprobePath = ffprobePath
      return ffprobePath
    }
  }

  const systemPath = findSystemBinary('ffprobe')
  if (systemPath) {
    cachedFFprobePath = systemPath
    return systemPath
  }

  return ''
}

export function checkFFmpegStatus(): FFmpegStatus {
  const ffmpegPath = getFFmpegPath()

  if (!ffmpegPath) {
    return {
      available: false,
      path: '',
      version: '',
      error: 'FFmpeg not found. Please install FFmpeg or provide a custom path.',
    }
  }

  const version = getFFmpegVersion(ffmpegPath)
  return {
    available: true,
    path: ffmpegPath,
    version,
  }
}

export function setCustomFFmpegPath(path: string): FFmpegStatus {
  cachedFFmpegPath = null
  cachedFFprobePath = null

  if (!path) {
    appSettings.delete('customFfmpegPath')
    return checkFFmpegStatus()
  }

  if (!validateBinaryPath(path)) {
    return {
      available: false,
      path: '',
      version: '',
      error: 'Invalid FFmpeg path. The file does not exist or is not executable.',
    }
  }

  appSettings.set('customFfmpegPath', path)
  return checkFFmpegStatus()
}

export function clearFFmpegCache(): void {
  cachedFFmpegPath = null
  cachedFFprobePath = null
}

export interface GPUCapability {
  hasNvenc: boolean
  hasAmf: boolean
  hasQsv: boolean
  hasVideoToolbox: boolean
  recommended: string
  allAvailable: string[]
}

let cachedCapability: GPUCapability | null = null

export async function detectGPUCapability(): Promise<GPUCapability> {
  if (cachedCapability) return cachedCapability

  const ffmpegPath = getFFmpegPath()
  if (!ffmpegPath) {
    cachedCapability = {
      hasNvenc: false,
      hasAmf: false,
      hasQsv: false,
      hasVideoToolbox: false,
      recommended: 'libx264',
      allAvailable: [],
    }
    return cachedCapability
  }

  return new Promise((resolve) => {
    const ffmpeg = spawn(ffmpegPath, [...getCommonFFmpegArgs(), '-encoders'])
    let output = ''

    ffmpeg.stdout.on('data', (data) => {
      output += data
    })

    ffmpeg.on('close', () => {
      const hasNvenc = output.includes('h264_nvenc')
      const hasAmf = output.includes('h264_amf')
      const hasQsv = output.includes('h264_qsv')
      const hasVideoToolbox = output.includes('h264_videotoolbox')

      const allAvailable: string[] = []
      if (hasNvenc) allAvailable.push('h264_nvenc')
      if (hasAmf) allAvailable.push('h264_amf')
      if (hasQsv) allAvailable.push('h264_qsv')
      if (hasVideoToolbox) allAvailable.push('h264_videotoolbox')

      let recommended = 'libx264'

      if (process.platform === 'darwin') {
        if (hasVideoToolbox) recommended = 'h264_videotoolbox'
      } else if (process.platform === 'win32') {
        if (hasNvenc) recommended = 'h264_nvenc'
        else if (hasAmf) recommended = 'h264_amf'
        else if (hasQsv) recommended = 'h264_qsv'
      } else {
        if (hasNvenc) recommended = 'h264_nvenc'
        else if (hasQsv) recommended = 'h264_qsv'
      }

      cachedCapability = {
        hasNvenc,
        hasAmf,
        hasQsv,
        hasVideoToolbox,
        recommended,
        allAvailable,
      }
      resolve(cachedCapability)
    })

    ffmpeg.on('error', () => {
      cachedCapability = {
        hasNvenc: false,
        hasAmf: false,
        hasQsv: false,
        hasVideoToolbox: false,
        recommended: 'libx264',
        allAvailable: [],
      }
      resolve(cachedCapability)
    })
  })
}

export const QUALITY_MULTIPLIERS: Record<VideoQuality, number> = {
  low: 0.4,
  medium: 0.7,
  high: 1.0,
}

const MIN_BITRATE = 1_000_000
const MAX_BITRATE = 20_000_000

const DEFAULT_BITRATES: Record<VideoQuality, string> = {
  low: '2M',
  medium: '3.5M',
  high: '5M',
}

export function calculateTargetBitrate(originalBitrate: number, quality: VideoQuality): string {
  if (!originalBitrate || originalBitrate <= 0) {
    return DEFAULT_BITRATES[quality]
  }

  const multiplier = QUALITY_MULTIPLIERS[quality]
  let targetBitrate = Math.round(originalBitrate * multiplier)

  targetBitrate = Math.max(MIN_BITRATE, Math.min(MAX_BITRATE, targetBitrate))

  const mbps = targetBitrate / 1_000_000
  if (mbps >= 1) {
    return `${mbps.toFixed(1).replace(/\.0$/, '')}M`
  } else {
    return `${Math.round(targetBitrate / 1000)}k`
  }
}

export function getVideoEncoderArgs(encoder: string, bitrate: string): string[] {
  const bitrateValue = parseFloat(bitrate)
  const bufsize = `${Math.round(bitrateValue * 2)}M`

  switch (encoder) {
    case 'h264_nvenc':
      return ['-c:v', 'h264_nvenc', '-preset', 'p4', '-tune', 'll', '-rc', 'cbr', '-b:v', bitrate]

    case 'h264_amf':
      return ['-c:v', 'h264_amf', '-quality', 'speed', '-rc', 'cbr', '-b:v', bitrate]

    case 'h264_qsv':
      return ['-c:v', 'h264_qsv', '-preset', 'veryfast', '-b:v', bitrate]

    case 'h264_videotoolbox':
      return ['-c:v', 'h264_videotoolbox', '-realtime', '1', '-b:v', bitrate]

    case 'libx264':
    default:
      return [
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-tune',
        'zerolatency',
        '-b:v',
        bitrate,
        '-maxrate',
        bitrate,
        '-bufsize',
        bufsize,
      ]
  }
}

export function clearGPUCapabilityCache(): void {
  cachedCapability = null
}

const VIDEO_MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv',
  '.m4v': 'video/x-m4v',
  '.ts': 'video/mp2t',
  '.m2ts': 'video/mp2t',
}

export function getVideoMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'))
  return VIDEO_MIME_TYPES[ext] || 'video/mp4'
}

export interface VideoInfo {
  codec: string
  audioCodec: string
  width: number
  height: number
  duration: number
  bitrate: number
  needsTranscode: boolean
  needsAudioTranscode: boolean
  canRemux: boolean
}

export async function probeVideo(filePath: string): Promise<VideoInfo> {
  const ffprobePath = getFFprobePath()
  if (!ffprobePath) {
    throw new Error('FFprobe not available. Please install FFmpeg.')
  }

  return new Promise((resolve, reject) => {
    const ffprobe = spawn(ffprobePath, [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ])

    let output = ''
    let errorOutput = ''

    ffprobe.stdout.on('data', (data) => {
      output += data
    })

    ffprobe.stderr.on('data', (data) => {
      errorOutput += data
    })

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed with code ${code}: ${errorOutput}`))
        return
      }

      try {
        const info = JSON.parse(output)
        const videoStream = info.streams?.find(
          (s: { codec_type: string }) => s.codec_type === 'video',
        )
        const audioStream = info.streams?.find(
          (s: { codec_type: string }) => s.codec_type === 'audio',
        )

        const videoCodec = videoStream?.codec_name || 'unknown'
        const audioCodec = audioStream?.codec_name || 'unknown'

        const browserVideoSupported = ['h264', 'vp8', 'vp9', 'av1']
        const browserAudioSupported = ['aac', 'mp3', 'opus', 'vorbis', 'flac']

        const needsVideoTranscode = !browserVideoSupported.includes(videoCodec)
        const needsAudioTranscode = !browserAudioSupported.includes(audioCodec)
        const canRemux = videoCodec === 'h264' && !needsAudioTranscode

        resolve({
          codec: videoCodec,
          audioCodec,
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
          duration: parseFloat(info.format?.duration || '0'),
          bitrate: parseInt(info.format?.bit_rate || '0'),
          needsTranscode: needsVideoTranscode,
          needsAudioTranscode,
          canRemux,
        })
      } catch (e) {
        reject(new Error(`Failed to parse ffprobe output: ${e}`))
      }
    })

    ffprobe.on('error', (err) => {
      reject(new Error(`Failed to start ffprobe: ${err.message}`))
    })
  })
}

export async function generateVideoThumbnail(
  filePath: string,
  outputPath: string,
  timestamp?: number,
): Promise<boolean> {
  const ffmpegPath = getFFmpegPath()
  if (!ffmpegPath) return false

  return new Promise((resolve) => {
    const seekTime = timestamp ?? 1

    const ffmpeg = spawn(ffmpegPath, [
      ...getCommonFFmpegArgs(),
      '-ss',
      seekTime.toString(),
      '-i',
      filePath,
      '-vframes',
      '1',
      '-q:v',
      '2',
      '-vf',
      'scale=300:-1',
      '-y',
      outputPath,
    ])

    ffmpeg.on('close', (code) => {
      resolve(code === 0)
    })

    ffmpeg.on('error', () => {
      resolve(false)
    })
  })
}

export async function generateVideoThumbnailBuffer(
  filePath: string,
  timestamp?: number,
): Promise<Buffer | null> {
  const ffmpegPath = getFFmpegPath()
  if (!ffmpegPath) return null

  return new Promise((resolve) => {
    const seekTime = timestamp ?? 1

    const ffmpeg = spawn(ffmpegPath, [
      ...getCommonFFmpegArgs(),
      '-ss',
      seekTime.toString(),
      '-i',
      filePath,
      '-vframes',
      '1',
      '-q:v',
      '2',
      '-vf',
      'scale=300:-1',
      '-f',
      'image2pipe',
      '-vcodec',
      'mjpeg',
      'pipe:1',
    ])

    const chunks: Buffer[] = []

    ffmpeg.stdout.on('data', (chunk) => {
      chunks.push(chunk)
    })

    ffmpeg.on('close', (code) => {
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks))
      } else {
        resolve(null)
      }
    })

    ffmpeg.on('error', () => {
      resolve(null)
    })
  })
}
