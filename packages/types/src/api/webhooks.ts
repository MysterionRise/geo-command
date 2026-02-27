import { z } from 'zod'

const WebhookUserData = z.object({
  id: z.string(),
  email_addresses: z.array(
    z.object({
      email_address: z.string().email(),
      id: z.string(),
    }),
  ),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  primary_email_address_id: z.string(),
})

export const ClerkUserCreatedEvent = z.object({
  type: z.literal('user.created'),
  data: WebhookUserData,
})

export const ClerkUserUpdatedEvent = z.object({
  type: z.literal('user.updated'),
  data: WebhookUserData,
})

export const ClerkUserDeletedEvent = z.object({
  type: z.literal('user.deleted'),
  data: z.object({
    id: z.string(),
    deleted: z.literal(true),
  }),
})

export const ClerkOrganisationCreatedEvent = z.object({
  type: z.literal('organization.created'),
  data: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  }),
})

export const ClerkWebhookEvent = z.discriminatedUnion('type', [
  ClerkUserCreatedEvent,
  ClerkUserUpdatedEvent,
  ClerkUserDeletedEvent,
  ClerkOrganisationCreatedEvent,
])
export type ClerkWebhookEvent = z.infer<typeof ClerkWebhookEvent>
