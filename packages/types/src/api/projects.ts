import { z } from 'zod'

export const CreateProjectSchema = z.object({
  name: z.string().min(3).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(500).optional(),
  brandVoice: z.string().max(500).optional(),
  targetAudience: z.string().max(500).optional(),
  keywords: z.array(z.string()).default([]),
  language: z.string().default('en'),
  engineId: z.string().optional(),
})
export type CreateProject = z.infer<typeof CreateProjectSchema>

export const UpdateProjectSchema = CreateProjectSchema.partial()
export type UpdateProject = z.infer<typeof UpdateProjectSchema>

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  brandVoice: z.string().nullable(),
  targetAudience: z.string().nullable(),
  keywords: z.array(z.string()),
  language: z.string(),
  workspaceId: z.string(),
  engineId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Project = z.infer<typeof ProjectSchema>
