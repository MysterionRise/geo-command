import { describe, it, expect } from 'vitest'
import {
  CreateOrganisationSchema,
  CreateWorkspaceSchema,
  CreateInvitationSchema,
  ApiErrorSchema,
  ClerkWebhookEvent,
} from './index.js'

describe('CreateOrganisationSchema', () => {
  it('should accept valid input', () => {
    const result = CreateOrganisationSchema.parse({
      name: 'My Org',
      slug: 'my-org',
    })
    expect(result.name).toBe('My Org')
    expect(result.slug).toBe('my-org')
  })

  it('should reject empty name', () => {
    expect(() =>
      CreateOrganisationSchema.parse({ name: '', slug: 'my-org' }),
    ).toThrow()
  })

  it('should reject invalid slug characters', () => {
    expect(() =>
      CreateOrganisationSchema.parse({ name: 'My Org', slug: 'My Org!' }),
    ).toThrow()
  })
})

describe('CreateWorkspaceSchema', () => {
  it('should accept valid input', () => {
    const result = CreateWorkspaceSchema.parse({
      name: 'Workspace 1',
      slug: 'workspace-1',
    })
    expect(result.name).toBe('Workspace 1')
    expect(result.slug).toBe('workspace-1')
  })

  it('should reject slug with uppercase', () => {
    expect(() =>
      CreateWorkspaceSchema.parse({ name: 'WS', slug: 'MyWorkspace' }),
    ).toThrow()
  })
})

describe('CreateInvitationSchema', () => {
  it('should accept valid input', () => {
    const result = CreateInvitationSchema.parse({
      email: 'user@example.com',
      role: 'MEMBER',
    })
    expect(result.email).toBe('user@example.com')
    expect(result.role).toBe('MEMBER')
  })

  it('should default role to MEMBER', () => {
    const result = CreateInvitationSchema.parse({
      email: 'user@example.com',
    })
    expect(result.role).toBe('MEMBER')
  })

  it('should reject invalid email', () => {
    expect(() =>
      CreateInvitationSchema.parse({ email: 'not-an-email' }),
    ).toThrow()
  })
})

describe('ApiErrorSchema', () => {
  it('should validate error shape', () => {
    const result = ApiErrorSchema.parse({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        requestId: 'req_123',
      },
    })
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('ClerkWebhookEvent', () => {
  it('should parse user.created event', () => {
    const result = ClerkWebhookEvent.parse({
      type: 'user.created',
      data: {
        id: 'user_123',
        email_addresses: [
          { email_address: 'user@example.com', id: 'email_1' },
        ],
        first_name: 'John',
        last_name: 'Doe',
        primary_email_address_id: 'email_1',
      },
    })
    expect(result.type).toBe('user.created')
  })

  it('should parse user.deleted event', () => {
    const result = ClerkWebhookEvent.parse({
      type: 'user.deleted',
      data: { id: 'user_123', deleted: true },
    })
    expect(result.type).toBe('user.deleted')
  })

  it('should reject unknown event types', () => {
    expect(() =>
      ClerkWebhookEvent.parse({
        type: 'unknown.event',
        data: {},
      }),
    ).toThrow()
  })
})
