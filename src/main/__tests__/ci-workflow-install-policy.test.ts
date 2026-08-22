import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

function readInstallCommands(workflowFile: string): string[] {
  const workflow = readFileSync(resolve('.github/workflows', workflowFile), 'utf8')

  return [...workflow.matchAll(/- name: Install dependencies\s+run: (.+)/g)].map(([, command]) =>
    command.trim()
  )
}

describe('CI workflow dependency installation policy', () => {
  test.each([
    ['ci.yml', ['npm ci --ignore-scripts']],
    ['azure-static-web-apps-zealous-river-03bbb7100.yml', ['npm ci --ignore-scripts']],
    ['build-release.yml', ['npm ci --ignore-scripts', 'npm ci']]
  ])(
    'skips desktop native rebuilds only outside packaged jobs in %s',
    (workflowFile, expectedCommands) => {
      expect(readInstallCommands(workflowFile)).toEqual(expectedCommands)
    }
  )
})
