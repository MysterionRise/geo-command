import { Hono } from 'hono'
import { prisma } from '@geo-command/db'
import { success } from '../helpers.js'

export const engines = new Hono()

engines.get('/', async (c) => {
  const allEngines = await prisma.aIEngine.findMany({
    orderBy: { createdAt: 'asc' },
  })

  return c.json(success(allEngines))
})
