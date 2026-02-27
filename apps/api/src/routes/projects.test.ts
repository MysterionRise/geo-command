import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock external dependencies before importing app
vi.mock('@geo-command/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    workspace: { findUnique: vi.fn() },
    project: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    aIEngine: { findMany: vi.fn() },
    organisation: { findUnique: vi.fn() },
    prompt: { count: vi.fn(), create: vi.fn(), createMany: vi.fn(), findMany: vi.fn(), delete: vi.fn(), update: vi.fn() },
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

const ORG_ID = 'org-1'
const WS_ID = 'ws-1'
const BASE_PATH = `/api/organisations/${ORG_ID}/workspaces/${WS_ID}/projects`

const mockUser = {
  id: 'user-1',
  orgId: ORG_ID,
  role: 'ADMIN',
  clerkId: 'clerk-user-1',
}

const mockTenantDb = {
  project: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
  vi.mocked(tenantDb).mockReturnValue(mockTenantDb as any)
})

describe('GET /projects', () => {
  it('returns projects for workspace', async () => {
    const mockProjects = [
      { id: 'proj-1', name: 'Project 1', slug: 'project-1', workspaceId: WS_ID, _count: { prompts: 5 } },
      { id: 'proj-2', name: 'Project 2', slug: 'project-2', workspaceId: WS_ID, _count: { prompts: 0 } },
    ]
    mockTenantDb.project.findMany.mockResolvedValue(mockProjects)

    const res = await app.request(BASE_PATH, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(2)
    expect(json.data[0].name).toBe('Project 1')
  })
})

describe('POST /projects', () => {
  const validBody = {
    name: 'New Project',
    slug: 'new-project',
    description: 'A test project',
  }

  it('creates a project with valid body', async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({ id: WS_ID, orgId: ORG_ID } as any)
    vi.mocked(prisma.project.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.project.create).mockResolvedValue({
      id: 'proj-new',
      ...validBody,
      workspaceId: WS_ID,
      keywords: [],
      language: 'en',
    } as any)

    const res = await app.request(BASE_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.name).toBe('New Project')
    expect(json.data.slug).toBe('new-project')
  })

  it('returns 400 on invalid body', async () => {
    const res = await app.request(BASE_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ab', slug: 'INVALID SLUG!!!' }),
    })

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 409 on duplicate slug', async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({ id: WS_ID, orgId: ORG_ID } as any)
    vi.mocked(prisma.project.findUnique).mockResolvedValue({ id: 'existing', slug: 'new-project' } as any)

    const res = await app.request(BASE_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error.code).toBe('CONFLICT')
  })

  it('returns 404 when workspace not found', async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null)

    const res = await app.request(BASE_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })
})

describe('GET /projects/:projectId', () => {
  it('returns a project by ID', async () => {
    const mockProject = {
      id: 'proj-1',
      name: 'Project 1',
      slug: 'project-1',
      engine: null,
      _count: { prompts: 3, clusters: 1 },
    }
    mockTenantDb.project.findFirst.mockResolvedValue(mockProject)

    const res = await app.request(`${BASE_PATH}/proj-1`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.id).toBe('proj-1')
    expect(json.data.name).toBe('Project 1')
  })

  it('returns 404 for non-existent project', async () => {
    mockTenantDb.project.findFirst.mockResolvedValue(null)

    const res = await app.request(`${BASE_PATH}/non-existent`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })
})

describe('PATCH /projects/:projectId', () => {
  it('updates a project', async () => {
    mockTenantDb.project.findFirst.mockResolvedValue({
      id: 'proj-1',
      slug: 'old-slug',
      workspaceId: WS_ID,
    })
    vi.mocked(prisma.project.update).mockResolvedValue({
      id: 'proj-1',
      name: 'Updated Name',
      slug: 'old-slug',
    } as any)

    const res = await app.request(`${BASE_PATH}/proj-1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name' }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.name).toBe('Updated Name')
  })

  it('returns 404 when project does not exist', async () => {
    mockTenantDb.project.findFirst.mockResolvedValue(null)

    const res = await app.request(`${BASE_PATH}/non-existent`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 409 when changing slug to existing one', async () => {
    mockTenantDb.project.findFirst.mockResolvedValue({
      id: 'proj-1',
      slug: 'old-slug',
      workspaceId: WS_ID,
    })
    vi.mocked(prisma.project.findUnique).mockResolvedValue({ id: 'proj-2', slug: 'taken-slug' } as any)

    const res = await app.request(`${BASE_PATH}/proj-1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'taken-slug' }),
    })

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error.code).toBe('CONFLICT')
  })
})

describe('DELETE /projects/:projectId', () => {
  it('deletes a project', async () => {
    mockTenantDb.project.findFirst.mockResolvedValue({ id: 'proj-1' })
    vi.mocked(prisma.project.delete).mockResolvedValue({} as any)

    const res = await app.request(`${BASE_PATH}/proj-1`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.deleted).toBe(true)
  })

  it('returns 404 when project does not exist', async () => {
    mockTenantDb.project.findFirst.mockResolvedValue(null)

    const res = await app.request(`${BASE_PATH}/non-existent`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })
})
