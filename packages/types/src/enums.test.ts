import { describe, it, expect } from 'vitest'
import { PlanEnum, RoleEnum, hasMinimumRole, ROLE_HIERARCHY } from './enums.js'

describe('PlanEnum', () => {
  it('should accept valid plans', () => {
    expect(PlanEnum.parse('FREE')).toBe('FREE')
    expect(PlanEnum.parse('STARTER')).toBe('STARTER')
    expect(PlanEnum.parse('PROFESSIONAL')).toBe('PROFESSIONAL')
    expect(PlanEnum.parse('AGENCY')).toBe('AGENCY')
    expect(PlanEnum.parse('ENTERPRISE')).toBe('ENTERPRISE')
  })

  it('should reject invalid plans', () => {
    expect(() => PlanEnum.parse('INVALID')).toThrow()
  })
})

describe('RoleEnum', () => {
  it('should accept valid roles', () => {
    expect(RoleEnum.parse('OWNER')).toBe('OWNER')
    expect(RoleEnum.parse('ADMIN')).toBe('ADMIN')
    expect(RoleEnum.parse('MEMBER')).toBe('MEMBER')
    expect(RoleEnum.parse('VIEWER')).toBe('VIEWER')
  })

  it('should reject invalid roles', () => {
    expect(() => RoleEnum.parse('SUPERADMIN')).toThrow()
  })
})

describe('ROLE_HIERARCHY', () => {
  it('should have correct hierarchy order', () => {
    expect(ROLE_HIERARCHY.OWNER).toBeGreaterThan(ROLE_HIERARCHY.ADMIN)
    expect(ROLE_HIERARCHY.ADMIN).toBeGreaterThan(ROLE_HIERARCHY.MEMBER)
    expect(ROLE_HIERARCHY.MEMBER).toBeGreaterThan(ROLE_HIERARCHY.VIEWER)
  })
})

describe('hasMinimumRole', () => {
  it('should return true when user role meets minimum', () => {
    expect(hasMinimumRole('OWNER', 'ADMIN')).toBe(true)
    expect(hasMinimumRole('ADMIN', 'ADMIN')).toBe(true)
    expect(hasMinimumRole('OWNER', 'VIEWER')).toBe(true)
  })

  it('should return false when user role is below minimum', () => {
    expect(hasMinimumRole('VIEWER', 'ADMIN')).toBe(false)
    expect(hasMinimumRole('MEMBER', 'ADMIN')).toBe(false)
    expect(hasMinimumRole('ADMIN', 'OWNER')).toBe(false)
  })

  it('should return true when roles are equal', () => {
    expect(hasMinimumRole('VIEWER', 'VIEWER')).toBe(true)
    expect(hasMinimumRole('MEMBER', 'MEMBER')).toBe(true)
  })
})
