import { describe, it, expect, vi, beforeEach } from 'vitest'
import { app } from './app.js'

// Mock Clerk auth
vi.mock('@hono/clerk-auth', () => ({
  clerkMiddleware: () => {
    return async (c: any, next: any) => {
      const authHeader = c.req.header('authorization')
      if (authHeader) {
        c.set('clerkAuth', { userId: 'clerk_test_user' })
      } else {
        c.set('clerkAuth', { userId: null })
      }
      await next()
    }
  },
}))

// Mock Prisma
vi.mock('@geo-command/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    organisation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    workspace: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    invitation: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@geo-command/db/tenant', () => ({
  tenantDb: () => ({
    workspace: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'ws_1',
        name: 'Test Workspace',
        slug: 'test-workspace',
        orgId: 'org_1',
        createdAt: new Date().toISOString(),
      }),
    },
    invitation: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'inv_1',
        email: 'user@example.com',
        role: 'MEMBER',
        orgId: 'org_1',
        token: 'tok_1',
        expiresAt: new Date().toISOString(),
        acceptedAt: null,
        createdAt: new Date().toISOString(),
      }),
    },
  }),
}))

// Mock rate limiter to always allow
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: vi.fn(),
}))

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(),
}))

const { prisma } = await import('@geo-command/db')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Health check', () => {
  it('should return ok', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('ok')
  })
})

describe('X-Request-ID', () => {
  it('should include X-Request-ID header on all responses', async () => {
    const res = await app.request('/health')
    expect(res.headers.get('X-Request-ID')).toBeTruthy()
  })
})

describe('404 handler', () => {
  it('should return 404 for unknown non-api routes', async () => {
    const res = await app.request('/nonexistent')
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('should return 401 for unknown api routes without auth', async () => {
    const res = await app.request('/api/nonexistent')
    expect(res.status).toBe(401)
  })
})

describe('Authentication', () => {
  it('should return 401 for unauthenticated requests to /api/users/me', async () => {
    const res = await app.request('/api/users/me')
    expect(res.status).toBe(401)
  })

  it('should return user profile for authenticated requests', async () => {
    const mockUser = {
      id: 'user_1',
      clerkId: 'clerk_test_user',
      email: 'test@example.com',
      name: 'Test User',
      role: 'ADMIN',
      orgId: 'org_1',
      createdAt: new Date(),
    }

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

    const res = await app.request('/api/users/me', {
      headers: { Authorization: 'Bearer test_token' },
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.email).toBe('test@example.com')
  })
})

describe('Organisations', () => {
  const mockUser = {
    id: 'user_1',
    clerkId: 'clerk_test_user',
    email: 'test@example.com',
    name: 'Test User',
    role: 'ADMIN',
    orgId: 'org_1',
    createdAt: new Date(),
  }

  it('should list organisations for authenticated user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
    vi.mocked(prisma.organisation.findUnique).mockResolvedValue({
      id: 'org_1',
      name: 'Test Org',
      slug: 'test-org',
      plan: 'FREE',
      stripeCustomerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const res = await app.request('/api/organisations', {
      headers: { Authorization: 'Bearer test_token' },
    })
    expect(res.status).toBe(200)
  })

  it('should deny access to wrong org', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

    const res = await app.request('/api/organisations/other_org/workspaces', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test_token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Test', slug: 'test' }),
    })
    expect(res.status).toBe(403)
  })

  it('should deny VIEWER from creating workspaces', async () => {
    const viewerUser = { ...mockUser, role: 'VIEWER' }
    vi.mocked(prisma.user.findUnique).mockResolvedValue(viewerUser as any)

    const res = await app.request('/api/organisations/org_1/workspaces', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test_token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Test', slug: 'test' }),
    })
    expect(res.status).toBe(403)
  })
})
