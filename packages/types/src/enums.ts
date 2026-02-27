import { z } from 'zod'

export const PlanEnum = z.enum([
  'FREE',
  'STARTER',
  'PROFESSIONAL',
  'AGENCY',
  'ENTERPRISE',
])
export type Plan = z.infer<typeof PlanEnum>

export const PromptStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED'])
export type PromptStatus = z.infer<typeof PromptStatusEnum>

export const RoleEnum = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'])
export type Role = z.infer<typeof RoleEnum>

export const ROLE_HIERARCHY: Record<Role, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
}

export function hasMinimumRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}
