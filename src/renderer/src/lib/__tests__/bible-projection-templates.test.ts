import { describe, expect, it } from 'vitest'
import {
  BUILT_IN_BIBLE_PROJECTION_TEMPLATES,
  getBibleProjectionTemplate
} from '../bible-projection-templates'

describe('bible projection templates', () => {
  it('finds built-in templates by id', () => {
    expect(getBibleProjectionTemplate('dark-stage')).toBe(BUILT_IN_BIBLE_PROJECTION_TEMPLATES[0])
    expect(getBibleProjectionTemplate('missing')).toBeNull()
  })
})
