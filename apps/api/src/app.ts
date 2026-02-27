import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { clerkMiddleware } from '@hono/clerk-auth'
import { requestId } from './middleware/request-id.js'
import { loggerMiddleware } from './middleware/logger.js'
import { rateLimitMiddleware } from './middleware/rate-limit.js'
import { orgContext } from './middleware/org-context.js'
import { organisations } from './routes/organisations.js'
import { users } from './routes/users.js'
import { webhooks } from './routes/webhooks.js'
import { engines } from './routes/engines.js'
import { projects } from './routes/projects.js'
import { prompts } from './routes/prompts.js'
import { apiError } from './helpers.js'

type Variables = {
  requestId: string
  clerkAuth: { userId: string | null }
  userId: string
  orgId: string
  userRole: string
}

export const app = new Hono<{ Variables: Variables }>()

// Global middleware (applied to all routes)
app.use('*', cors())
app.use('*', requestId)
app.use('*', loggerMiddleware)

// Webhook routes (no auth, no rate limiting)
app.route('/api/webhooks', webhooks)

// Authenticated routes
app.use('/api/*', clerkMiddleware())
app.use('/api/*', rateLimitMiddleware)
app.use('/api/*', orgContext)

// Route handlers
app.route('/api/organisations', organisations)
app.route('/api/users', users)
app.route('/api/engines', engines)
app.route(
  '/api/organisations/:orgId/workspaces/:wsId/projects',
  projects,
)
app.route(
  '/api/organisations/:orgId/workspaces/:wsId/projects/:projectId/prompts',
  prompts,
)

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

// Global error handler
app.onError((err, c) => {
  const requestId = (c.get('requestId') as string) || 'unknown'
  console.error('Unhandled error:', err)
  return c.json(
    apiError('INTERNAL_ERROR', 'An unexpected error occurred', requestId),
    500,
  )
})

// 404 handler
app.notFound((c) => {
  const requestId = (c.get('requestId') as string) || 'unknown'
  return c.json(apiError('NOT_FOUND', 'Route not found', requestId), 404)
})
