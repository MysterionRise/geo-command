import { describe, it, expect } from 'vitest'
import { checkPermission, requireMutation, ForbiddenError } from './rbac.js'

describe('checkPermission', () => {
  it('should allow OWNER to do anything', () => {
    expect(checkPermission('OWNER', 'org:read')).toBe(true)
    expect(checkPermission('OWNER', 'org:update')).toBe(true)
    expect(checkPermission('OWNER', 'org:delete')).toBe(true)
    expect(checkPermission('OWNER', 'member:update_role')).toBe(true)
  })

  it('should allow ADMIN to manage workspaces and invitations', () => {
    expect(checkPermission('ADMIN', 'workspace:create')).toBe(true)
    expect(checkPermission('ADMIN', 'invitation:create')).toBe(true)
    expect(checkPermission('ADMIN', 'member:invite')).toBe(true)
  })

  it('should deny ADMIN from owner-only actions', () => {
    expect(checkPermission('ADMIN', 'org:delete')).toBe(false)
    expect(checkPermission('ADMIN', 'member:update_role')).toBe(false)
  })

  it('should allow VIEWER to read', () => {
    expect(checkPermission('VIEWER', 'org:read')).toBe(true)
    expect(checkPermission('VIEWER', 'workspace:read')).toBe(true)
    expect(checkPermission('VIEWER', 'member:read')).toBe(true)
  })

  it('should deny VIEWER from mutations', () => {
    expect(checkPermission('VIEWER', 'workspace:create')).toBe(false)
    expect(checkPermission('VIEWER', 'member:invite')).toBe(false)
  })

  it('should return false for unknown permissions', () => {
    expect(checkPermission('OWNER', 'nonexistent:action')).toBe(false)
  })
})

describe('requireMutation', () => {
  it('should not throw for ADMIN+', () => {
    expect(() => requireMutation('ADMIN')).not.toThrow()
    expect(() => requireMutation('OWNER')).not.toThrow()
  })

  it('should throw ForbiddenError for MEMBER', () => {
    expect(() => requireMutation('MEMBER')).toThrow(ForbiddenError)
  })

  it('should throw ForbiddenError for VIEWER', () => {
    expect(() => requireMutation('VIEWER')).toThrow(ForbiddenError)
  })
})
