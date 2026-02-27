import { z } from 'zod'
import { RoleEnum } from '../enums.js'

export const UserMeSchema = z.object({
  id: z.string(),
  clerkId: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: RoleEnum,
  orgId: z.string(),
  createdAt: z.string().datetime(),
})
export type UserMe = z.infer<typeof UserMeSchema>
