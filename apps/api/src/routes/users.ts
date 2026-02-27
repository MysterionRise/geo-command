import { Hono } from 'hono'
import { prisma } from '@geo-command/db'
import { success, apiError } from '../helpers.js'

export const users = new Hono()

users.get('/me', async (c) => {
  const userId = c.get('userId') as string
  const requestId = c.get('requestId') as string

  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    return c.json(apiError('NOT_FOUND', 'User not found', requestId), 404)
  }

  return c.json(success(user))
})
