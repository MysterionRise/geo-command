import { type Role, hasMinimumRole } from '@geo-command/types/enums'

export class ForbiddenError extends Error {
  constructor(message = 'Insufficient permissions') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

const PERMISSION_ROLE_MAP: Record<string, Role> = {
  'org:read': 'VIEWER',
  'org:update': 'ADMIN',
  'org:delete': 'OWNER',
  'workspace:read': 'VIEWER',
  'workspace:create': 'ADMIN',
  'workspace:update': 'ADMIN',
  'workspace:delete': 'ADMIN',
  'member:read': 'VIEWER',
  'member:invite': 'ADMIN',
  'member:remove': 'ADMIN',
  'member:update_role': 'OWNER',
  'invitation:read': 'ADMIN',
  'invitation:create': 'ADMIN',
  'invitation:revoke': 'ADMIN',
}

export function checkPermission(userRole: Role, permission: string): boolean {
  const requiredRole = PERMISSION_ROLE_MAP[permission]
  if (!requiredRole) return false
  return hasMinimumRole(userRole, requiredRole)
}

export function requireMutation(userRole: Role): void {
  if (!hasMinimumRole(userRole, 'ADMIN')) {
    throw new ForbiddenError('Mutations require ADMIN role or higher')
  }
}
