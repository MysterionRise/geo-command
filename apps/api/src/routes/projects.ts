import { Hono } from 'hono'
import { prisma } from '@geo-command/db'
import { tenantDb } from '@geo-command/db/tenant'
import { CreateProjectSchema, UpdateProjectSchema } from '@geo-command/types/api'
import { requireRole } from '../middleware/rbac.js'
import { success, apiError } from '../helpers.js'

export const projects = new Hono()

// List projects in workspace
projects.get('/', async (c) => {
  const orgId = c.get('orgId') as string
  const wsId = c.req.param('wsId')
  const db = tenantDb(orgId)

  const projectList = await db.project.findMany({
    where: { workspaceId: wsId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { prompts: true } } },
  })

  return c.json(success(projectList))
})

// Create project
projects.post('/', requireRole('ADMIN'), async (c) => {
  const requestId = c.get('requestId') as string
  const orgId = c.get('orgId') as string
  const wsId = c.req.param('wsId')
  const body = await c.req.json()
  const parsed = CreateProjectSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      apiError('VALIDATION_ERROR', parsed.error.message, requestId),
      400,
    )
  }

  // Verify workspace belongs to the org
  const workspace = await prisma.workspace.findUnique({
    where: { id: wsId },
  })

  if (!workspace || workspace.orgId !== orgId) {
    return c.json(
      apiError('NOT_FOUND', 'Workspace not found', requestId),
      404,
    )
  }

  // Check slug uniqueness within workspace
  const existing = await prisma.project.findUnique({
    where: {
      workspaceId_slug: { workspaceId: wsId, slug: parsed.data.slug },
    },
  })

  if (existing) {
    return c.json(
      apiError('CONFLICT', 'Project slug already exists in this workspace', requestId),
      409,
    )
  }

  const project = await prisma.project.create({
    data: {
      ...parsed.data,
      workspaceId: wsId,
    },
  })

  return c.json(success(project), 201)
})

// Get project by ID
projects.get('/:projectId', async (c) => {
  const orgId = c.get('orgId') as string
  const projectId = c.req.param('projectId')
  const db = tenantDb(orgId)

  const project = await db.project.findFirst({
    where: { id: projectId },
    include: {
      engine: true,
      _count: { select: { prompts: true, clusters: true } },
    },
  })

  if (!project) {
    const requestId = c.get('requestId') as string
    return c.json(
      apiError('NOT_FOUND', 'Project not found', requestId),
      404,
    )
  }

  return c.json(success(project))
})

// Update project
projects.patch('/:projectId', requireRole('ADMIN'), async (c) => {
  const requestId = c.get('requestId') as string
  const orgId = c.get('orgId') as string
  const projectId = c.req.param('projectId')
  const body = await c.req.json()
  const parsed = UpdateProjectSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      apiError('VALIDATION_ERROR', parsed.error.message, requestId),
      400,
    )
  }

  const db = tenantDb(orgId)
  const existing = await db.project.findFirst({
    where: { id: projectId },
  })

  if (!existing) {
    return c.json(
      apiError('NOT_FOUND', 'Project not found', requestId),
      404,
    )
  }

  // If slug is being changed, check uniqueness
  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    const slugConflict = await prisma.project.findUnique({
      where: {
        workspaceId_slug: {
          workspaceId: existing.workspaceId,
          slug: parsed.data.slug,
        },
      },
    })

    if (slugConflict) {
      return c.json(
        apiError('CONFLICT', 'Project slug already exists in this workspace', requestId),
        409,
      )
    }
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: parsed.data,
  })

  return c.json(success(project))
})

// Delete project
projects.delete('/:projectId', requireRole('ADMIN'), async (c) => {
  const orgId = c.get('orgId') as string
  const projectId = c.req.param('projectId')
  const db = tenantDb(orgId)

  const existing = await db.project.findFirst({
    where: { id: projectId },
  })

  if (!existing) {
    const requestId = c.get('requestId') as string
    return c.json(
      apiError('NOT_FOUND', 'Project not found', requestId),
      404,
    )
  }

  await prisma.project.delete({ where: { id: projectId } })

  return c.json(success({ deleted: true }))
})
