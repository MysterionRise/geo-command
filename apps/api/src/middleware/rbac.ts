import { createMiddleware } from 'hono/factory'
import { type Role, hasMinimumRole } from '@geo-command/types/enums'
import { apiError } from '../helpers.js'

export function requireRole(minimumRole: Role) {
  return createMiddleware(async (c, next) => {
    const userRole = c.get('userRole') as Role

    if (!userRole || !hasMinimumRole(userRole, minimumRole)) {
      const requestId = c.get('requestId') as string
      return c.json(
        apiError(
          'FORBIDDEN',
          `Requires ${minimumRole} role or higher`,
          requestId,
        ),
        403,
      )
    }

    await next()
  })
}
