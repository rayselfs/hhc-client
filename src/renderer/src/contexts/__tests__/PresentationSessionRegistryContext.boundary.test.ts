import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('PresentationSessionRegistryContext startup boundary', () => {
  it('loads presentation editor runtime modules only when opening a session', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/renderer/src/contexts/PresentationSessionRegistryContext.tsx'),
      'utf8'
    )

    expect(source).not.toContain(
      "import { loadEditablePresentationSnapshot } from '@renderer/lib/editable-presentation'"
    )
    expect(source).not.toContain("} from '@renderer/lib/editable-presentation-persistence'")
    expect(source).toContain("import('@renderer/lib/editable-presentation')")
    expect(source).toContain("import('@renderer/lib/presentation-editor-session')")
  })
})
