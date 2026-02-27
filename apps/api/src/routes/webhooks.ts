import { Hono } from 'hono'
import { verifyClerkWebhook } from '@geo-command/auth/webhook'
import { ClerkWebhookEvent } from '@geo-command/types/api'
import { prisma } from '@geo-command/db'
import { logger } from '../middleware/logger.js'
import { success, apiError } from '../helpers.js'

export const webhooks = new Hono()

webhooks.post('/clerk', async (c) => {
  const requestId = c.get('requestId') as string

  const payload = await c.req.text()
  const svixId = c.req.header('svix-id')
  const svixTimestamp = c.req.header('svix-timestamp')
  const svixSignature = c.req.header('svix-signature')

  try {
    verifyClerkWebhook(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    })
  } catch {
    return c.json(
      apiError('WEBHOOK_VERIFICATION_FAILED', 'Invalid webhook signature', requestId),
      400,
    )
  }

  const body = JSON.parse(payload)
  const parsed = ClerkWebhookEvent.safeParse(body)

  if (!parsed.success) {
    logger.warn({ requestId, type: body.type }, 'Unhandled webhook event type')
    return c.json(success({ received: true }))
  }

  const event = parsed.data

  switch (event.type) {
    case 'user.created': {
      const primaryEmail = event.data.email_addresses.find(
        (e) => e.id === event.data.primary_email_address_id,
      )
      if (!primaryEmail) break

      const name = [event.data.first_name, event.data.last_name]
        .filter(Boolean)
        .join(' ') || null

      let org = await prisma.organisation.findFirst()
      if (!org) {
        org = await prisma.organisation.create({
          data: { name: 'Default', slug: 'default' },
        })
      }

      await prisma.user.create({
        data: {
          clerkId: event.data.id,
          email: primaryEmail.email_address,
          name,
          orgId: org.id,
        },
      })
      logger.info({ requestId, clerkId: event.data.id }, 'User created from webhook')
      break
    }

    case 'user.updated': {
      const primaryEmail = event.data.email_addresses.find(
        (e) => e.id === event.data.primary_email_address_id,
      )
      if (!primaryEmail) break

      const name = [event.data.first_name, event.data.last_name]
        .filter(Boolean)
        .join(' ') || null

      await prisma.user.update({
        where: { clerkId: event.data.id },
        data: {
          email: primaryEmail.email_address,
          name,
        },
      })
      logger.info({ requestId, clerkId: event.data.id }, 'User updated from webhook')
      break
    }

    case 'user.deleted': {
      await prisma.user.delete({
        where: { clerkId: event.data.id },
      })
      logger.info({ requestId, clerkId: event.data.id }, 'User deleted from webhook')
      break
    }

    case 'organization.created': {
      await prisma.organisation.create({
        data: {
          name: event.data.name,
          slug: event.data.slug,
        },
      })
      logger.info({ requestId, orgSlug: event.data.slug }, 'Organisation created from webhook')
      break
    }
  }

  return c.json(success({ received: true }))
})
