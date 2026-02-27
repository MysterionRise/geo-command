import { Webhook } from 'svix'

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebhookVerificationError'
  }
}

export function verifyClerkWebhook(
  payload: string,
  headers: {
    'svix-id'?: string
    'svix-timestamp'?: string
    'svix-signature'?: string
  },
) {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) {
    throw new WebhookVerificationError('CLERK_WEBHOOK_SECRET is not set')
  }

  const svixId = headers['svix-id']
  const svixTimestamp = headers['svix-timestamp']
  const svixSignature = headers['svix-signature']

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new WebhookVerificationError('Missing svix headers')
  }

  const wh = new Webhook(secret)

  try {
    return wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    })
  } catch {
    throw new WebhookVerificationError('Invalid webhook signature')
  }
}
