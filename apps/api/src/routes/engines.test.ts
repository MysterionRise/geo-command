import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock external dependencies before importing app
vi.mock('@geo-command/db', () => ({
  prisma: {
    aIEngine: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    project: { findUnique: vi.fn() },
  },
}))

vi.mock('@geo-command/db/tenant', () => ({
  tenantDb: () => ({}),
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

const mockUser = {
  id: 'user-1',
  orgId: 'org-1',
  role: 'ADMIN',
  clerkId: 'clerk-user-1',
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
})

describe('GET /api/engines', () => {
  it('returns a list of engines', async () => {
    const mockEngines = [
      { id: 'eng-1', name: 'GPT-4o', provider: 'openai', model: 'gpt-4o', createdAt: new Date() },
      { id: 'eng-2', name: 'Claude 3.5', provider: 'anthropic', model: 'claude-3-5-sonnet', createdAt: new Date() },
    ]

    vi.mocked(prisma.aIEngine.findMany).mockResolvedValue(mockEngines as any)

    const res = await app.request('/api/engines', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(2)
    expect(json.data[0].name).toBe('GPT-4o')
    expect(json.data[1].name).toBe('Claude 3.5')
  })

  it('returns empty array when no engines exist', async () => {
    vi.mocked(prisma.aIEngine.findMany).mockResolvedValue([])

    const res = await app.request('/api/engines', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toEqual([])
  })
})
