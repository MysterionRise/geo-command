import { z } from 'zod'
import { RoleEnum } from '../enums.js'

export const CreateInvitationSchema = z.object({
  email: z.string().email(),
  role: RoleEnum.default('MEMBER'),
})
export type CreateInvitation = z.infer<typeof CreateInvitationSchema>

export const InvitationSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: RoleEnum,
  orgId: z.string(),
  token: z.string(),
  expiresAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})
export type Invitation = z.infer<typeof InvitationSchema>
