import { z } from 'zod'

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
})
export type CreateWorkspace = z.infer<typeof CreateWorkspaceSchema>

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  orgId: z.string(),
  createdAt: z.string().datetime(),
})
export type Workspace = z.infer<typeof WorkspaceSchema>
