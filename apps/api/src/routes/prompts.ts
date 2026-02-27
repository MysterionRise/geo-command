import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { prisma } from '@geo-command/db'
import { tenantDb } from '@geo-command/db/tenant'
import {
  CreatePromptSchema,
  BulkImportPromptsSchema,
  GeneratePromptsSchema,
} from '@geo-command/types/api'
import { getPromptLimit } from '@geo-command/types/plan-limits'
import type { Plan } from '@geo-command/types/enums'
import { PromptGenerator } from '@geo-command/ai'
import { embeddingQueue, clusteringQueue } from '@geo-command/queue'
import { requireRole } from '../middleware/rbac.js'
import { requireProject } from '../middleware/project-context.js'
import { success, apiError } from '../helpers.js'

export const prompts = new Hono()

// Apply project context middleware to all routes
prompts.use('*', requireProject())

// List prompts with pagination and status filter
prompts.get('/', async (c) => {
  const orgId = c.get('orgId') as string
  const projectId = c.get('projectId' as never) as string
  const db = tenantDb(orgId)

  const page = parseInt(c.req.query('page') || '1')
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100)
  const status = c.req.query('status')
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = { projectId }
  if (status) {
    where.status = status
  }

  const [items, total] = await Promise.all([
    db.prompt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { cluster: { select: { id: true, label: true } } },
    }),
    db.prompt.count({ where }),
  ])

  return c.json(success({ items, total, page, limit }))
})

// Create single prompt
prompts.post('/', requireRole('MEMBER'), async (c) => {
  const requestId = c.get('requestId') as string
  const orgId = c.get('orgId') as string
  const projectId = c.get('projectId' as never) as string
  const body = await c.req.json()
  const parsed = CreatePromptSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      apiError('VALIDATION_ERROR', parsed.error.message, requestId),
      400,
    )
  }

  // Check plan limit
  const org = await prisma.organisation.findUnique({
    where: { id: orgId },
  })
  if (!org) {
    return c.json(apiError('NOT_FOUND', 'Organisation not found', requestId), 404)
  }

  const currentCount = await prisma.prompt.count({
    where: { project: { workspace: { orgId } } },
  })
  const planLimit = getPromptLimit(org.plan as Plan)

  if (currentCount >= planLimit) {
    return c.json(
      apiError('PLAN_LIMIT', `Prompt limit reached (${planLimit}) for ${org.plan} plan`, requestId),
      403,
    )
  }

  const prompt = await prisma.prompt.create({
    data: {
      text: parsed.data.text,
      status: parsed.data.status || 'DRAFT',
      source: 'manual',
      projectId,
    },
  })

  // Enqueue embedding job
  await embeddingQueue.add('embed', {
    promptIds: [prompt.id],
    orgId,
  })

  return c.json(success(prompt), 201)
})

// Bulk import
prompts.post('/bulk', requireRole('ADMIN'), async (c) => {
  const requestId = c.get('requestId') as string
  const orgId = c.get('orgId') as string
  const projectId = c.get('projectId' as never) as string
  const body = await c.req.json()
  const parsed = BulkImportPromptsSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      apiError('VALIDATION_ERROR', parsed.error.message, requestId),
      400,
    )
  }

  // Check plan limit
  const org = await prisma.organisation.findUnique({
    where: { id: orgId },
  })
  if (!org) {
    return c.json(apiError('NOT_FOUND', 'Organisation not found', requestId), 404)
  }

  const currentCount = await prisma.prompt.count({
    where: { project: { workspace: { orgId } } },
  })
  const planLimit = getPromptLimit(org.plan as Plan)
  const newCount = currentCount + parsed.data.prompts.length

  if (newCount > planLimit) {
    return c.json(
      apiError(
        'PLAN_LIMIT',
        `Import would exceed prompt limit (${planLimit}) for ${org.plan} plan. Current: ${currentCount}, importing: ${parsed.data.prompts.length}`,
        requestId,
      ),
      403,
    )
  }

  const created = await prisma.prompt.createMany({
    data: parsed.data.prompts.map((p) => ({
      text: p.text,
      source: 'csv',
      projectId,
    })),
  })

  // Get created prompt IDs for embedding
  const createdPrompts = await prisma.prompt.findMany({
    where: { projectId, source: 'csv' },
    orderBy: { createdAt: 'desc' },
    take: created.count,
    select: { id: true },
  })

  await embeddingQueue.add('embed', {
    promptIds: createdPrompts.map((p) => p.id),
    orgId,
  })

  return c.json(success({ imported: created.count }), 201)
})

// AI generation with SSE streaming
prompts.post('/generate', requireRole('ADMIN'), async (c) => {
  const requestId = c.get('requestId') as string
  const orgId = c.get('orgId') as string
  const projectId = c.get('projectId' as never) as string
  const body = await c.req.json()
  const parsed = GeneratePromptsSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      apiError('VALIDATION_ERROR', parsed.error.message, requestId),
      400,
    )
  }

  // Check plan limit
  const org = await prisma.organisation.findUnique({
    where: { id: orgId },
  })
  if (!org) {
    return c.json(apiError('NOT_FOUND', 'Organisation not found', requestId), 404)
  }

  const currentCount = await prisma.prompt.count({
    where: { project: { workspace: { orgId } } },
  })
  const planLimit = getPromptLimit(org.plan as Plan)

  if (currentCount + parsed.data.count > planLimit) {
    return c.json(
      apiError(
        'PLAN_LIMIT',
        `Generation would exceed prompt limit (${planLimit}) for ${org.plan} plan`,
        requestId,
      ),
      403,
    )
  }

  // Fetch project config
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })
  if (!project) {
    return c.json(apiError('NOT_FOUND', 'Project not found', requestId), 404)
  }

  // Fetch existing prompts for dedup
  const existingPrompts = await prisma.prompt.findMany({
    where: { projectId },
    select: { text: true },
  })

  return streamSSE(c, async (stream) => {
    try {
      const generator = new PromptGenerator()
      let totalGenerated = 0
      const createdIds: string[] = []

      const gen = generator.generate(
        {
          brandVoice: project.brandVoice || '',
          targetAudience: project.targetAudience || '',
          keywords: project.keywords,
          language: project.language,
          existingPrompts: existingPrompts.map((p) => p.text),
        },
        parsed.data.count,
        async (generated) => {
          await stream.writeSSE({
            event: 'progress',
            data: JSON.stringify({
              type: 'progress',
              generated,
              total: parsed.data.count,
            }),
          })
        },
      )

      const batch: { text: string; rationale: string }[] = []

      for await (const prompt of gen) {
        batch.push(prompt)

        // Save in batches of 10
        if (batch.length >= 10 || totalGenerated + batch.length >= parsed.data.count) {
          const created = await prisma.$transaction(
            batch.map((p) =>
              prisma.prompt.create({
                data: {
                  text: p.text,
                  source: 'ai',
                  projectId,
                },
              }),
            ),
          )

          createdIds.push(...created.map((p) => p.id))
          totalGenerated += batch.length

          await stream.writeSSE({
            event: 'batch',
            data: JSON.stringify({
              type: 'batch',
              prompts: created,
              progress: `${totalGenerated}/${parsed.data.count}`,
            }),
          })

          batch.length = 0
        }
      }

      // Enqueue embedding for all generated prompts
      if (createdIds.length > 0) {
        await embeddingQueue.add('embed', {
          promptIds: createdIds,
          orgId,
        })
      }

      await stream.writeSSE({
        event: 'complete',
        data: JSON.stringify({
          type: 'complete',
          totalGenerated,
        }),
      })
    } catch (err) {
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({
          type: 'error',
          message: err instanceof Error ? err.message : 'Generation failed',
        }),
      })
    }
  })
})

// Update prompt status
prompts.patch('/:promptId', requireRole('MEMBER'), async (c) => {
  const requestId = c.get('requestId') as string
  const orgId = c.get('orgId') as string
  const promptId = c.req.param('promptId')
  const body = await c.req.json()
  const db = tenantDb(orgId)

  const existing = await db.prompt.findFirst({
    where: { id: promptId },
  })

  if (!existing) {
    return c.json(
      apiError('NOT_FOUND', 'Prompt not found', requestId),
      404,
    )
  }

  const { status } = body
  if (!status || !['DRAFT', 'ACTIVE', 'ARCHIVED'].includes(status)) {
    return c.json(
      apiError('VALIDATION_ERROR', 'Invalid status', requestId),
      400,
    )
  }

  const prompt = await prisma.prompt.update({
    where: { id: promptId },
    data: { status },
  })

  return c.json(success(prompt))
})

// Delete prompt
prompts.delete('/:promptId', requireRole('ADMIN'), async (c) => {
  const orgId = c.get('orgId') as string
  const promptId = c.req.param('promptId')
  const db = tenantDb(orgId)

  const existing = await db.prompt.findFirst({
    where: { id: promptId },
  })

  if (!existing) {
    const requestId = c.get('requestId') as string
    return c.json(
      apiError('NOT_FOUND', 'Prompt not found', requestId),
      404,
    )
  }

  await prisma.prompt.delete({ where: { id: promptId } })

  return c.json(success({ deleted: true }))
})

// Trigger re-clustering
prompts.post('/cluster', requireRole('ADMIN'), async (c) => {
  const orgId = c.get('orgId') as string
  const projectId = c.get('projectId' as never) as string

  await clusteringQueue.add('cluster', {
    projectId,
    orgId,
  })

  return c.json(success({ queued: true }))
})

// Get clusters with prompt counts
prompts.get('/clusters', async (c) => {
  const orgId = c.get('orgId') as string
  const projectId = c.get('projectId' as never) as string
  const db = tenantDb(orgId)

  const clusters = await db.promptCluster.findMany({
    where: { projectId },
    include: {
      _count: { select: { prompts: true } },
      prompts: {
        select: { id: true, text: true, status: true },
        take: 10,
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return c.json(success(clusters))
})
