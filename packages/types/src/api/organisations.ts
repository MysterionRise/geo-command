import { z } from 'zod'
import { PlanEnum } from '../enums'

export const CreateOrganisationSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
})
export type CreateOrganisation = z.infer<typeof CreateOrganisationSchema>

export const OrganisationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  plan: PlanEnum,
  stripeCustomerId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Organisation = z.infer<typeof OrganisationSchema>
