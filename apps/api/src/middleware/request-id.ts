import { createMiddleware } from 'hono/factory'
import { nanoid } from 'nanoid'

export const requestId = createMiddleware(async (c, next) => {
  const id = nanoid()
  c.set('requestId', id)
  c.header('X-Request-ID', id)
  await next()
})
