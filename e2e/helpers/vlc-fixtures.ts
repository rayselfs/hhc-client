import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const fixtureRoot = resolve(process.cwd(), 'e2e/fixtures/vlc')

export interface VlcFixture {
  file: string
  sha256: string
  size: number
  container: 'mp4' | 'matroska'
  codec: string
  readable: boolean
  durationSeconds?: { min: number; max: number }
  allowedDiagnostics: string[]
  expectedSeekable: boolean
  expectedPlayback: 'native' | 'vlc-embedded' | 'failure'
  expectedRemux: 'source' | 'matroska-remux' | 'matroska-remux-failed'
  expectedFailureCode?: string
  matroska?: {
    requiredElementIds: string[]
    seekHeadCuesReferenceOffset?: number
    missingCuesOffset?: number
    minimumClusterCount?: number
  }
}

export interface VlcFixtureManifest {
  version: number
  provenance: Record<string, string | number>
  fixtures: VlcFixture[]
}

export interface VerifiedVlcFixtures {
  root: string
  manifest: VlcFixtureManifest
  manifestBytes: Buffer
  paths: Record<string, string>
}

function occurrences(bytes: Buffer, id: string): number[] {
  const needle = Buffer.from(id, 'hex')
  const offsets: number[] = []
  for (
    let offset = bytes.indexOf(needle);
    offset >= 0;
    offset = bytes.indexOf(needle, offset + 1)
  ) {
    offsets.push(offset)
  }
  return offsets
}

function assertDiagnostics(fixture: VlcFixture, stderr: string): void {
  const unexpected = stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !fixture.allowedDiagnostics.some((pattern) => new RegExp(pattern).test(line)))
  if (unexpected.length > 0) {
    throw new Error(`${fixture.file}: unexpected FFmpeg diagnostics: ${unexpected.join(' | ')}`)
  }
}

function finalDurationSeconds(stdout: string): number | null {
  const values = [...stdout.matchAll(/^out_time_us=(\d+)$/gm)]
  const value = values.at(-1)?.[1]
  return value ? Number(value) / 1_000_000 : null
}

async function verifyDecode(ffmpegPath: string, fixture: VlcFixture, path: string): Promise<void> {
  const args = [
    '-nostdin',
    '-v',
    'error',
    ...(fixture.readable ? [] : ['-xerror']),
    '-i',
    path,
    '-map',
    '0',
    '-progress',
    'pipe:1',
    '-nostats',
    '-f',
    'null',
    '-'
  ]
  try {
    const result = await execFileAsync(ffmpegPath, args, { maxBuffer: 256 * 1024 })
    if (!fixture.readable) throw new Error(`${fixture.file}: FFmpeg unexpectedly decoded fixture`)
    assertDiagnostics(fixture, result.stderr)
    const duration = finalDurationSeconds(result.stdout)
    const expected = fixture.durationSeconds
    if (duration === null || !expected || duration < expected.min || duration > expected.max) {
      throw new Error(`${fixture.file}: decoded duration ${String(duration)} is outside manifest`)
    }
  } catch (error) {
    if (fixture.readable) throw error
    const stderr = (error as { stderr?: string }).stderr ?? ''
    assertDiagnostics(fixture, stderr)
    if (!(error as { code?: number }).code) throw error
  }
}

export async function verifyVlcFixtures(ffmpegPath: string): Promise<VerifiedVlcFixtures> {
  const manifestBytes = await readFile(join(fixtureRoot, 'manifest.json'))
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as VlcFixtureManifest
  const paths: Record<string, string> = {}

  for (const fixture of manifest.fixtures) {
    const path = join(fixtureRoot, fixture.file)
    const [bytes, fileStat] = await Promise.all([readFile(path), stat(path)])
    const digest = createHash('sha256').update(bytes).digest('hex')
    if (fileStat.size !== fixture.size || digest !== fixture.sha256) {
      throw new Error(`${fixture.file}: fixture size or SHA-256 does not match manifest`)
    }
    if (fixture.container === 'matroska') {
      if (!bytes.subarray(0, 4).equals(Buffer.from('1a45dfa3', 'hex'))) {
        throw new Error(`${fixture.file}: missing EBML header`)
      }
      for (const id of fixture.matroska?.requiredElementIds ?? []) {
        if (occurrences(bytes, id).length === 0) throw new Error(`${fixture.file}: missing ${id}`)
      }
      const clusterCount = occurrences(bytes, '1f43b675').length
      if (clusterCount < (fixture.matroska?.minimumClusterCount ?? 0)) {
        throw new Error(`${fixture.file}: insufficient readable Clusters`)
      }
      const cuesOffsets = occurrences(bytes, '1c53bb6b')
      const cuesReference = fixture.matroska?.seekHeadCuesReferenceOffset
      if (cuesReference !== undefined && !cuesOffsets.includes(cuesReference)) {
        throw new Error(`${fixture.file}: missing SeekHead Cues reference`)
      }
      const missingCues = fixture.matroska?.missingCuesOffset
      if (
        missingCues !== undefined &&
        (bytes.length !== missingCues || cuesOffsets.includes(missingCues))
      ) {
        throw new Error(`${fixture.file}: Cues truncation does not match manifest`)
      }
    }
    await verifyDecode(ffmpegPath, fixture, path)
    paths[fixture.file] = path
  }

  return { root: fixtureRoot, manifest, manifestBytes, paths }
}
