import { ipcMain, app, nativeImage, protocol } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import * as Sentry from '@sentry/electron'
import path from 'path'
import fs from 'fs-extra'
import { spawn, ChildProcess } from 'child_process'
import {
  getFFmpegPath,
  probeVideo,
  VideoInfo,
  getVideoMimeType,
  generateVideoThumbnailBuffer,
  detectGPUCapability,
  getVideoEncoderArgs,
  calculateTargetBitrate,
  getCommonFFmpegArgs,
} from './ffmpeg'
import { getVideoQuality } from './appSettings'

// Track active FFmpeg processes for cleanup
const activeFFmpegProcesses = new Map<string, ChildProcess>()

// Extensions that need transcoding
const TRANSCODE_EXTENSIONS = ['.mkv', '.avi', '.wmv', '.flv', '.ts', '.m2ts', '.mov']

// All video extensions (for thumbnail generation)
const VIDEO_EXTENSIONS = [
  '.mp4',
  '.webm',
  '.ogg',
  '.mkv',
  '.avi',
  '.wmv',
  '.flv',
  '.ts',
  '.m2ts',
  '.mov',
  '.m4v',
]

// Check if file is a video
function isVideoFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return VIDEO_EXTENSIONS.includes(ext)
}

// Check if file extension needs transcoding
function needsTranscodeByExtension(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return TRANSCODE_EXTENSIONS.includes(ext)
}

// Check if FFmpeg exists
async function ffmpegExists(): Promise<boolean> {
  try {
    await fs.access(getFFmpegPath())
    return true
  } catch {
    return false
  }
}

// Build FFmpeg arguments based on video info
async function buildFFmpegArgs(filePath: string, videoInfo: VideoInfo): Promise<string[]> {
  const commonArgs = getCommonFFmpegArgs()
  const seekArgs: string[] = []
  const durationArgs: string[] = []

  // Case 1: Only needs Remux (H.264 + supported audio)
  if (videoInfo.canRemux) {
    return [
      ...commonArgs,
      ...seekArgs,
      '-i',
      filePath,
      ...durationArgs,
      '-c:v',
      'copy',
      '-c:a',
      'aac', // Convert audio to AAC for compatibility
      '-movflags',
      'frag_keyframe+empty_moov+faststart',
      '-f',
      'mp4',
      'pipe:1',
    ]
  }

  // Case 2: H.264 but audio needs transcoding
  if (!videoInfo.needsTranscode && videoInfo.needsAudioTranscode) {
    return [
      ...commonArgs,
      ...seekArgs,
      '-i',
      filePath,
      ...durationArgs,
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-movflags',
      'frag_keyframe+empty_moov+faststart',
      '-f',
      'mp4',
      'pipe:1',
    ]
  }

  // Case 3: Needs video transcoding - detect GPU and choose encoder
  const gpuCapability = await detectGPUCapability()

  // Calculate target bitrate based on original bitrate and quality setting
  const quality = getVideoQuality()
  const targetBitrate = calculateTargetBitrate(videoInfo.bitrate, quality)
  const encoderArgs = getVideoEncoderArgs(gpuCapability.recommended, targetBitrate)

  return [
    ...seekArgs,
    '-i',
    filePath,
    ...durationArgs,
    ...encoderArgs,
    '-c:a',
    'aac',
    '-movflags',
    'frag_keyframe+empty_moov+faststart',
    '-f',
    'mp4',
    'pipe:1',
  ]
}

// Handle transcoding stream request
async function handleTranscodeStream(filePath: string): Promise<Response> {
  // Check if FFmpeg exists
  if (!(await ffmpegExists())) {
    console.error('FFmpeg not found at:', getFFmpegPath())
    return new Response('FFmpeg not available', { status: 500 })
  }

  let videoInfo: VideoInfo
  try {
    videoInfo = await probeVideo(filePath)
  } catch (error) {
    console.error('Failed to probe video:', error)
    return new Response('Failed to analyze video file', { status: 500 })
  }

  const ffmpegArgs = await buildFFmpegArgs(filePath, videoInfo)
  const ffmpeg = spawn(getFFmpegPath(), ffmpegArgs)
  const streamId = `${Date.now()}-${Math.random()}`
  activeFFmpegProcesses.set(streamId, ffmpeg)

  // Flag to track if we've already signaled this process to die
  let isKilling = false

  const safeKill = () => {
    if (isKilling) return
    isKilling = true
    try {
      if (!ffmpeg.killed) {
        ffmpeg.kill('SIGTERM')
      }
    } catch (err) {
      console.warn('Failed to kill FFmpeg process:', err)
    }
  }

  // Log FFmpeg stderr for debugging
  ffmpeg.stderr.on('data', (data) => {
    // Only log non-progress messages (progress messages start with 'frame=')
    const message = data.toString()

    // Ignore hard exit messages caused by our safeKill
    if (
      message.includes('Received > 3 system signals') ||
      message.includes('Immediate exit requested') ||
      message.includes('Error closing file')
    ) {
      return
    }

    if (!message.startsWith('frame=') && !message.startsWith('size=')) {
      console.log('FFmpeg:', message.trim())
    }
  })

  // Convert Node.js stream to Web ReadableStream
  const readable = new ReadableStream({
    start(controller) {
      ffmpeg.stdout.on('data', (chunk) => {
        try {
          controller.enqueue(chunk)
        } catch {
          safeKill()
        }
      })

      ffmpeg.stdout.on('end', () => {
        try {
          controller.close()
        } catch {
          // ignore
        }
        activeFFmpegProcesses.delete(streamId)
      })

      ffmpeg.stdout.on('error', (err) => {
        try {
          controller.error(err)
        } catch {
          // ignore
        }
        activeFFmpegProcesses.delete(streamId)
        // If pipe breaks, we should kill the process
        safeKill()
      })

      ffmpeg.on('error', (err) => {
        console.error('FFmpeg process error:', err)
        activeFFmpegProcesses.delete(streamId)
      })

      ffmpeg.on('close', (code) => {
        // Exit codes:
        // 0: Success
        // 123: Received > 3 signals (SIGTERM), normal when video is switched
        // 255: Killed by signal (normal when stream cancelled)
        // Other codes: Actual errors
        if (code !== 0 && code !== 123 && code !== 255 && code !== null) {
          console.error('FFmpeg exited with error code:', code)
        }
        activeFFmpegProcesses.delete(streamId)
      })
    },
    cancel() {
      safeKill()
      activeFFmpegProcesses.delete(streamId)
    },
  })

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type': 'video/mp4',
      'Transfer-Encoding': 'chunked',
      'X-Transcode-Mode': videoInfo.canRemux ? 'remux' : 'transcode',
      'X-Video-Codec': videoInfo.codec,
    },
  })
}

// Cleanup function for FFmpeg processes (call on app quit)
export function cleanupFFmpegProcesses() {
  activeFFmpegProcesses.forEach((proc) => {
    proc.kill('SIGTERM')
  })
  activeFFmpegProcesses.clear()
}

/**
 * Registers a custom protocol 'local-resource://' to safely serve local files.
 * Handles quirks between Windows and macOS/Linux.
 */
export const registerFileProtocols = () => {
  protocol.handle('local-resource', async (request) => {
    try {
      const requestUrl = new URL(request.url)

      // Decode the URL path (handling spaces and special chars)
      let filePath = decodeURIComponent(requestUrl.pathname)

      // On Windows, the drive letter might be in the hostname for some URL constructions,
      // or the path might start with a slash that needs removing (e.g. /C:/...)
      if (process.platform === 'win32') {
        // Case 1: Host contains the drive letter (e.g., local-resource://c/path/to/file)
        if (requestUrl.host && /^[a-zA-Z]$/.test(requestUrl.host)) {
          filePath = `${requestUrl.host}:${filePath}`
        }
        // Case 2: Path starts with a leading slash before the drive letter (e.g., /C:/path)
        else if (filePath.match(/^\/[a-zA-Z]:/)) {
          filePath = filePath.slice(1)
        }

        // Normalize separates (converts / to \ on Windows) and resolves '..'
        filePath = path.normalize(filePath)
      } else {
        // macOS/Linux: Just ensure it's treated as an absolute path if host is present
        if (requestUrl.host) {
          filePath = path.join('/', requestUrl.host, filePath)
        }
        filePath = path.normalize(filePath)
      }

      // Security Check
      if (filePath.includes('..')) {
        console.warn('Blocked potential path traversal:', filePath)
        return new Response('Forbidden', { status: 403 })
      }

      // Check if file exists
      try {
        await fs.access(filePath)
      } catch {
        return new Response('Not Found', { status: 404 })
      }

      // Check if this file needs transcoding (MKV, AVI, etc.)
      if (needsTranscodeByExtension(filePath)) {
        return handleTranscodeStream(filePath)
      }

      const stat = await fs.stat(filePath)
      const fileSize = stat.size
      const rangeHeader = request.headers.get('Range')

      // Handle Range Request (Video stream / Seek)
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
        const chunksize = end - start + 1

        const stream = fs.createReadStream(filePath, { start, end })

        return nodeStreamToWebResponse(stream, 206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize.toString(),
          'Content-Type': getMimeType(filePath),
        })
      }

      // Handle Full Request
      const stream = fs.createReadStream(filePath)
      return nodeStreamToWebResponse(stream, 200, {
        'Content-Length': fileSize.toString(),
        'Content-Type': getMimeType(filePath),
        'Accept-Ranges': 'bytes',
      })
    } catch (error) {
      console.error('Failed to handle protocol request:', request.url, error)
      return new Response('Internal Server Error', { status: 500 })
    }
  })
}

/**
 * Helper to convert a Node.js ReadStream to a Web Response with a ReadableStream.
 * Handles stream lifecycle and errors safely.
 */
function nodeStreamToWebResponse(
  stream: fs.ReadStream,
  status: number,
  headers: Record<string, string>,
): Response {
  const readable = new ReadableStream({
    start(controller) {
      stream.on('data', (chunk) => {
        try {
          controller.enqueue(chunk)
        } catch {
          // Controller closed or request cancelled
          stream.destroy()
        }
      })
      stream.on('end', () => {
        try {
          controller.close()
        } catch {
          // Ignore
        }
      })
      stream.on('error', (err) => {
        try {
          controller.error(err)
        } catch {
          // Ignore
        }
      })
    },
    cancel() {
      stream.destroy()
    },
  })

  return new Response(readable, { status, headers })
}

// Helper to determine mime type
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    // Video formats
    case '.mp4':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    case '.ogg':
      return 'video/ogg'
    case '.mkv':
      return 'video/x-matroska'
    case '.avi':
      return 'video/x-msvideo'
    case '.mov':
      return 'video/quicktime'
    case '.wmv':
      return 'video/x-ms-wmv'
    case '.flv':
      return 'video/x-flv'
    case '.m4v':
      return 'video/x-m4v'
    case '.ts':
    case '.m2ts':
      return 'video/mp2t'
    // Audio formats
    case '.mp3':
      return 'audio/mpeg'
    case '.wav':
      return 'audio/wav'
    // Image formats
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.gif':
      return 'image/gif'
    case '.svg':
      return 'image/svg+xml'
    // Document formats
    case '.pdf':
      return 'application/pdf'
    default:
      return 'application/octet-stream'
  }
}

// getMimeType removed as net.fetch handles content-type automatically for file:// protocol

export const registerFileHandlers = () => {
  // Handle save file
  ipcMain.handle('save-file', async (event, sourcePath: string) => {
    try {
      const userDataPath = app.getPath('userData')
      const mediaDir = path.join(userDataPath, 'media')

      // Ensure media directory exists
      await fs.ensureDir(mediaDir)

      const ext = path.extname(sourcePath)
      const filename = `${uuidv4()}${ext}`
      const destinationPath = path.join(mediaDir, filename)

      // Async copy
      await fs.copy(sourcePath, destinationPath)

      // Generate thumbnail and get video metadata
      let thumbnailData: Buffer | undefined
      let videoMetadata: { duration: number; mimeType: string } | undefined

      if (isVideoFile(destinationPath)) {
        // For video files, use FFmpeg for thumbnail and ffprobe for metadata
        try {
          // Get video info (duration, codec, etc.)
          const videoInfo = await probeVideo(destinationPath)
          videoMetadata = {
            duration: videoInfo.duration,
            mimeType: getVideoMimeType(destinationPath),
          }

          // Generate thumbnail at 1 second or 10% of duration (whichever is smaller)
          const thumbnailTime = Math.min(1, videoInfo.duration * 0.1)
          const thumbBuffer = await generateVideoThumbnailBuffer(destinationPath, thumbnailTime)
          if (thumbBuffer) {
            thumbnailData = thumbBuffer
          }
        } catch (videoError) {
          console.warn('Failed to process video metadata/thumbnail:', videoError)
          // Fallback: try native thumbnail
          try {
            const thumb = await nativeImage.createThumbnailFromPath(destinationPath, {
              width: 300,
              height: 300,
            })
            if (!thumb.isEmpty()) {
              thumbnailData = thumb.toJPEG(80)
            }
          } catch {
            // Ignore fallback failure
          }
        }
      } else {
        // For non-video files, use native thumbnail generation
        try {
          const thumb = await nativeImage.createThumbnailFromPath(destinationPath, {
            width: 300,
            height: 300,
          })

          if (!thumb.isEmpty()) {
            thumbnailData = thumb.toJPEG(80)
          }
        } catch (thumbError) {
          console.warn('Failed to generate thumbnail:', thumbError)
        }
      }

      return {
        filePath: destinationPath,
        thumbnailData,
        videoMetadata,
      }
    } catch (error) {
      console.error('Failed to save file:', error)
      Sentry.captureException(error, {
        tags: { operation: 'save-file' },
        extra: { sourcePath },
      })
      throw error
    }
  })

  // Handle list directory (Lazy Loading support)
  ipcMain.handle('list-directory', async (event, dirPath: string) => {
    try {
      const userDataPath = app.getPath('userData')
      const targetPath = path.isAbsolute(dirPath) ? dirPath : path.join(userDataPath, dirPath)

      // Security check
      if (!targetPath.startsWith(userDataPath)) {
        throw new Error('Access denied: Output outside userData')
      }

      const entries = await fs.readdir(targetPath, { withFileTypes: true })
      return await Promise.all(
        entries.map(async (entry) => {
          const entryPath = path.join(targetPath, entry.name)
          const stats = await fs.stat(entryPath)
          const isDirectory = entry.isDirectory()

          return {
            name: entry.name,
            isDirectory,
            path: entryPath,
            size: stats.size,
            modifiedAt: stats.mtimeMs,
          }
        }),
      )
    } catch (error) {
      console.error('Failed to list directory:', error)
      return []
    }
  })

  // Handle reset user data
  ipcMain.handle('reset-user-data', async () => {
    try {
      const userDataPath = app.getPath('userData')
      const mediaDir = path.join(userDataPath, 'media')

      await Promise.all([fs.remove(mediaDir).catch(() => {})])

      return true
    } catch (error) {
      console.error('Failed to reset user data:', error)
      return false
    }
  })

  // Handle delete file
  ipcMain.handle('delete-file', async (event, filePath: string) => {
    try {
      const userDataPath = app.getPath('userData')
      const normalizedFilePath = path.normalize(filePath)
      const normalizedUserDataPath = path.normalize(userDataPath)

      if (!normalizedFilePath.startsWith(normalizedUserDataPath)) {
        console.warn('Security alert: Attempted to delete file outside userData:', filePath)
        return false
      }

      await fs.remove(normalizedFilePath)
      return true
    } catch (error) {
      console.warn('Failed to delete file:', filePath, error)
      return false
    }
  })

  // Handle copy file
  ipcMain.handle('copy-file', async (event, sourceUrl: string) => {
    try {
      const userDataPath = app.getPath('userData')
      let cleanSourcePath = sourceUrl
      if (cleanSourcePath.startsWith('local-resource://')) {
        cleanSourcePath = cleanSourcePath.replace('local-resource://', '')
      }

      const normalizedSourcePath = path.normalize(cleanSourcePath)
      const normalizedUserDataPath = path.normalize(userDataPath)

      if (!normalizedSourcePath.startsWith(normalizedUserDataPath)) {
        console.warn('Security alert: Attempted to copy file from outside userData:', sourceUrl)
        return null
      }

      const mediaDir = path.join(userDataPath, 'media')
      const ext = path.extname(normalizedSourcePath)
      const newFilename = `${uuidv4()}${ext}`
      const destinationPath = path.join(mediaDir, newFilename)

      await fs.copy(normalizedSourcePath, destinationPath)

      // We don't copy physical thumbnails anymore,
      // they will be generated if missing or we could just skip for copy
      // For now, let's just return the new file path.
      // Frontend can handle thumbnail migration or re-generation if needed.

      return {
        filePath: destinationPath,
      }
    } catch (error) {
      console.error('Failed to copy file:', sourceUrl, error)
      return null
    }
  })
}
