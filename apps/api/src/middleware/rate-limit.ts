import { createMiddleware } from 'hono/factory'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { apiError } from '../helpers.js'

let ratelimit: Ratelimit | null = null

function getRatelimit() {
  if (ratelimit) return ratelimit

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) return null

  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    prefix: 'geo-command:ratelimit',
  })

  return ratelimit
}

export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const rl = getRatelimit()
  if (!rl) {
    await next()
    return
  }

  const orgId = (c.get('orgId') as string) || 'anonymous'
  const { success, limit, remaining, reset } = await rl.limit(orgId)

  c.header('X-RateLimit-Limit', limit.toString())
  c.header('X-RateLimit-Remaining', remaining.toString())

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000)
    c.header('Retry-After', retryAfter.toString())
    const requestId = c.get('requestId') as string
    return c.json(
      apiError('RATE_LIMITED', 'Too many requests', requestId),
      429,
    )
  }

  await next()
})
