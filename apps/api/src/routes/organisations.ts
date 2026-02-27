import { Hono } from 'hono'
import { prisma } from '@geo-command/db'
import { tenantDb } from '@geo-command/db/tenant'
import { CreateOrganisationSchema } from '@geo-command/types/api'
import { requireRole } from '../middleware/rbac.js'
import { success, apiError } from '../helpers.js'

export const organisations = new Hono()

organisations.get('/', async (c) => {
  const orgId = c.get('orgId') as string
  const org = await prisma.organisation.findUnique({
    where: { id: orgId },
  })

  if (!org) {
    const requestId = c.get('requestId') as string
    return c.json(
      apiError('NOT_FOUND', 'Organisation not found', requestId),
      404,
    )
  }

  return c.json(success(org))
})

organisations.post('/', requireRole('ADMIN'), async (c) => {
  const requestId = c.get('requestId') as string
  const body = await c.req.json()
  const parsed = CreateOrganisationSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      apiError('VALIDATION_ERROR', parsed.error.message, requestId),
      400,
    )
  }

  const existing = await prisma.organisation.findUnique({
    where: { slug: parsed.data.slug },
  })

  if (existing) {
    return c.json(
      apiError('CONFLICT', 'Organisation slug already exists', requestId),
      409,
    )
  }

  const org = await prisma.organisation.create({
    data: parsed.data,
  })

  return c.json(success(org), 201)
})

organisations.post('/:id/workspaces', requireRole('ADMIN'), async (c) => {
  const requestId = c.get('requestId') as string
  const orgId = c.get('orgId') as string
  const body = await c.req.json()

  const { CreateWorkspaceSchema } = await import('@geo-command/types/api')
  const parsed = CreateWorkspaceSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      apiError('VALIDATION_ERROR', parsed.error.message, requestId),
      400,
    )
  }

  const db = tenantDb(orgId)
  const existing = await db.workspace.findFirst({
    where: { slug: parsed.data.slug },
  })

  if (existing) {
    return c.json(
      apiError('CONFLICT', 'Workspace slug already exists in this org', requestId),
      409,
    )
  }

  const workspace = await db.workspace.create({
    data: parsed.data,
  })

  return c.json(success(workspace), 201)
})

organisations.post('/:id/invitations', requireRole('ADMIN'), async (c) => {
  const requestId = c.get('requestId') as string
  const orgId = c.get('orgId') as string
  const body = await c.req.json()

  const { CreateInvitationSchema } = await import('@geo-command/types/api')
  const parsed = CreateInvitationSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      apiError('VALIDATION_ERROR', parsed.error.message, requestId),
      400,
    )
  }

  const db = tenantDb(orgId)

  const existingInvite = await db.invitation.findFirst({
    where: {
      email: parsed.data.email,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
  })

  if (existingInvite) {
    return c.json(
      apiError('CONFLICT', 'Active invitation already exists for this email', requestId),
      409,
    )
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const invitation = await db.invitation.create({
    data: {
      email: parsed.data.email,
      role: parsed.data.role,
      expiresAt,
    },
  })

  return c.json(success(invitation), 201)
})
