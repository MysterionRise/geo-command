import { createMiddleware } from 'hono/factory'
import pino from 'pino'

export const logger = pino({
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty' }
      : undefined,
  redact: ['email', 'name', 'req.headers.authorization'],
})

export const loggerMiddleware = createMiddleware(async (c, next) => {
  const start = Date.now()
  const requestId = c.get('requestId') as string

  await next()

  const duration = Date.now() - start
  logger.info({
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration,
  })
})
