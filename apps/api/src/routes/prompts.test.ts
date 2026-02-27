import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock external dependencies before importing app
vi.mock('@geo-command/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    organisation: { findUnique: vi.fn() },
    workspace: { findUnique: vi.fn() },
    project: { findUnique: vi.fn(), findMany: vi.fn() },
    prompt: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    aIEngine: { findMany: vi.fn() },
  },
}))

vi.mock('@geo-command/db/tenant', () => ({
  tenantDb: vi.fn(),
}))

vi.mock('@hono/clerk-auth', () => ({
  clerkMiddleware: () => async (c: any, next: any) => {
    c.set('clerkAuth', { userId: 'clerk-user-1' })
    await next()
  },
  getAuth: () => ({ userId: 'clerk-user-1' }),
}))

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow() { return {} }
  },
}))

vi.mock('@upstash/redis', () => ({
  Redis: class {},
}))

vi.mock('@geo-command/ai', () => ({
  PromptGenerator: class {},
}))

vi.mock('@geo-command/queue', () => ({
  embeddingQueue: { add: vi.fn() },
  clusteringQueue: { add: vi.fn() },
}))

import { app } from '../app.js'
import { prisma } from '@geo-command/db'
import { tenantDb } from '@geo-command/db/tenant'
import { embeddingQueue } from '@geo-command/queue'

const ORG_ID = 'org-1'
const WS_ID = 'ws-1'
const PROJECT_ID = 'proj-1'
const BASE_PATH = `/api/organisations/${ORG_ID}/workspaces/${WS_ID}/projects/${PROJECT_ID}/prompts`

const mockUser = {
  id: 'user-1',
  orgId: ORG_ID,
  role: 'ADMIN',
  clerkId: 'clerk-user-1',
}

const mockTenantDb = {
  prompt: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  },
  promptCluster: {
    findMany: vi.fn(),
  },
  project: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
  vi.mocked(tenantDb).mockReturnValue(mockTenantDb as any)
  // requireProject middleware needs prisma.project.findUnique
  vi.mocked(prisma.project.findUnique).mockResolvedValue({
    id: PROJECT_ID,
    workspaceId: WS_ID,
    workspace: { orgId: ORG_ID, id: WS_ID },
  } as any)
})

describe('GET /prompts', () => {
  it('returns paginated prompts', async () => {
    const mockPrompts = [
      { id: 'p-1', text: 'Prompt one', status: 'DRAFT', cluster: null },
      { id: 'p-2', text: 'Prompt two', status: 'ACTIVE', cluster: { id: 'c-1', label: 'Cluster 1' } },
    ]
    mockTenantDb.prompt.findMany.mockResolvedValue(mockPrompts)
    mockTenantDb.prompt.count.mockResolvedValue(2)

    const res = await app.request(`${BASE_PATH}?page=1&limit=50`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.items).toHaveLength(2)
    expect(json.data.total).toBe(2)
    expect(json.data.page).toBe(1)
    expect(json.data.limit).toBe(50)
  })
})

describe('POST /prompts', () => {
  it('creates a prompt with valid body', async () => {
    vi.mocked(prisma.organisation.findUnique).mockResolvedValue({
      id: ORG_ID,
      plan: 'PROFESSIONAL',
    } as any)
    vi.mocked(prisma.prompt.count).mockResolvedValue(10)
    vi.mocked(prisma.prompt.create).mockResolvedValue({
      id: 'p-new',
      text: 'New test prompt',
      status: 'DRAFT',
      source: 'manual',
      projectId: PROJECT_ID,
    } as any)
    vi.mocked(embeddingQueue.add).mockResolvedValue(undefined as any)

    const res = await app.request(BASE_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'New test prompt' }),
    })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.text).toBe('New test prompt')
    expect(json.data.source).toBe('manual')
    expect(embeddingQueue.add).toHaveBeenCalledWith('embed', {
      promptIds: ['p-new'],
      orgId: ORG_ID,
    })
  })

  it('returns 400 on invalid body', async () => {
    const res = await app.request(BASE_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '' }),
    })

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 403 when plan limit is reached', async () => {
    vi.mocked(prisma.organisation.findUnique).mockResolvedValue({
      id: ORG_ID,
      plan: 'FREE',
    } as any)
    // FREE plan limit is 50
    vi.mocked(prisma.prompt.count).mockResolvedValue(50)

    const res = await app.request(BASE_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'One more prompt' }),
    })

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error.code).toBe('PLAN_LIMIT')
  })
})

describe('POST /prompts/bulk', () => {
  it('imports prompts in bulk', async () => {
    vi.mocked(prisma.organisation.findUnique).mockResolvedValue({
      id: ORG_ID,
      plan: 'PROFESSIONAL',
    } as any)
    vi.mocked(prisma.prompt.count).mockResolvedValue(10)
    vi.mocked(prisma.prompt.createMany).mockResolvedValue({ count: 3 } as any)
    vi.mocked(prisma.prompt.findMany).mockResolvedValue([
      { id: 'p-1' },
      { id: 'p-2' },
      { id: 'p-3' },
    ] as any)
    vi.mocked(embeddingQueue.add).mockResolvedValue(undefined as any)

    const res = await app.request(`${BASE_PATH}/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompts: [
          { text: 'Prompt A' },
          { text: 'Prompt B' },
          { text: 'Prompt C' },
        ],
      }),
    })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.imported).toBe(3)
    expect(embeddingQueue.add).toHaveBeenCalled()
  })

  it('returns 403 when bulk import would exceed plan limit', async () => {
    vi.mocked(prisma.organisation.findUnique).mockResolvedValue({
      id: ORG_ID,
      plan: 'FREE',
    } as any)
    // FREE plan limit is 50, current count is 48, trying to import 5
    vi.mocked(prisma.prompt.count).mockResolvedValue(48)

    const res = await app.request(`${BASE_PATH}/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompts: [
          { text: 'A' },
          { text: 'B' },
          { text: 'C' },
          { text: 'D' },
          { text: 'E' },
        ],
      }),
    })

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error.code).toBe('PLAN_LIMIT')
  })
})

describe('PATCH /prompts/:promptId', () => {
  it('updates prompt status', async () => {
    mockTenantDb.prompt.findFirst.mockResolvedValue({
      id: 'p-1',
      text: 'Some prompt',
      status: 'DRAFT',
    })
    vi.mocked(prisma.prompt.update).mockResolvedValue({
      id: 'p-1',
      text: 'Some prompt',
      status: 'ACTIVE',
    } as any)

    const res = await app.request(`${BASE_PATH}/p-1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.status).toBe('ACTIVE')
  })

  it('returns 404 for non-existent prompt', async () => {
    mockTenantDb.prompt.findFirst.mockResolvedValue(null)

    const res = await app.request(`${BASE_PATH}/non-existent`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' }),
    })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 400 for invalid status', async () => {
    mockTenantDb.prompt.findFirst.mockResolvedValue({
      id: 'p-1',
      text: 'Some prompt',
      status: 'DRAFT',
    })

    const res = await app.request(`${BASE_PATH}/p-1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'INVALID' }),
    })

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('DELETE /prompts/:promptId', () => {
  it('deletes a prompt', async () => {
    mockTenantDb.prompt.findFirst.mockResolvedValue({ id: 'p-1' })
    vi.mocked(prisma.prompt.delete).mockResolvedValue({} as any)

    const res = await app.request(`${BASE_PATH}/p-1`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.deleted).toBe(true)
  })

  it('returns 404 for non-existent prompt', async () => {
    mockTenantDb.prompt.findFirst.mockResolvedValue(null)

    const res = await app.request(`${BASE_PATH}/non-existent`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })
})

describe('GET /prompts/clusters', () => {
  it('returns clusters with prompt counts', async () => {
    const mockClusters = [
      {
        id: 'c-1',
        label: 'Cluster 1',
        projectId: PROJECT_ID,
        _count: { prompts: 5 },
        prompts: [
          { id: 'p-1', text: 'Prompt 1', status: 'ACTIVE' },
        ],
      },
    ]
    mockTenantDb.promptCluster.findMany.mockResolvedValue(mockClusters)

    const res = await app.request(`${BASE_PATH}/clusters`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.data[0].label).toBe('Cluster 1')
    expect(json.data[0]._count.prompts).toBe(5)
  })
})
