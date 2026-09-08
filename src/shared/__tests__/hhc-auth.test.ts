import { describe, expect, it } from 'vitest'
import { canAccessHhcAdmin } from '../hhc-auth'

describe('canAccessHhcAdmin', () => {
  it.each([
    '*',
    'cms:read',
    'campaigns:read',
    'users:read',
    'rbac:read',
    'media-sync:manage',
    'dsr:read',
    'users:manage',
    'rbac:manage',
    'dsr:manage'
  ])('allows %s', (permission) => {
    expect(canAccessHhcAdmin([permission])).toBe(true)
  })

  it.each([
    { permissions: [] },
    { permissions: ['presenter:cloud:use'] },
    { permissions: ['cms:write'] }
  ])('denies $permissions', ({ permissions }) => {
    expect(canAccessHhcAdmin(permissions)).toBe(false)
  })
})
