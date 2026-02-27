import { createMiddleware } from 'hono/factory'
import { prisma } from '@geo-command/db'
import { apiError } from '../helpers.js'

export const orgContext = createMiddleware(async (c, next) => {
  const clerkAuth = c.get('clerkAuth')
  if (!clerkAuth?.userId) {
    const requestId = c.get('requestId') as string
    return c.json(apiError('UNAUTHORIZED', 'Not authenticated', requestId), 401)
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: clerkAuth.userId },
  })

  if (!user) {
    const requestId = c.get('requestId') as string
    return c.json(apiError('USER_NOT_FOUND', 'User not found', requestId), 404)
  }

  c.set('userId', user.id)
  c.set('orgId', user.orgId)
  c.set('userRole', user.role)

  // Extract org ID from path like /api/organisations/:id/...
  const match = c.req.path.match(/^\/api\/organisations\/([^/]+)/)
  const orgIdParam = match?.[1]
  if (orgIdParam && orgIdParam !== user.orgId) {
    const requestId = c.get('requestId') as string
    return c.json(
      apiError('FORBIDDEN', 'Access denied to this organisation', requestId),
      403,
    )
  }

  await next()
})
