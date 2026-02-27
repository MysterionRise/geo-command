import { createMiddleware } from 'hono/factory'
import { prisma } from '@geo-command/db'
import { apiError } from '../helpers.js'

export function requireProject() {
  return createMiddleware(async (c, next) => {
    const requestId = c.get('requestId') as string
    const orgId = c.get('orgId') as string
    const projectId = c.req.param('projectId')

    if (!projectId) {
      return c.json(
        apiError('VALIDATION_ERROR', 'Project ID is required', requestId),
        400,
      )
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { workspace: { select: { orgId: true, id: true } } },
    })

    if (!project) {
      return c.json(
        apiError('NOT_FOUND', 'Project not found', requestId),
        404,
      )
    }

    if (project.workspace.orgId !== orgId) {
      return c.json(
        apiError('FORBIDDEN', 'Access denied to this project', requestId),
        403,
      )
    }

    c.set('projectId' as never, project.id)
    c.set('workspaceId' as never, project.workspaceId)

    await next()
  })
}
