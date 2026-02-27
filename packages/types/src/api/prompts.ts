import { z } from 'zod'
import { PromptStatusEnum } from '../enums'

export const CreatePromptSchema = z.object({
  text: z.string().min(1).max(500),
  status: PromptStatusEnum.optional(),
})
export type CreatePrompt = z.infer<typeof CreatePromptSchema>

export const BulkImportPromptsSchema = z.object({
  prompts: z
    .array(z.object({ text: z.string() }))
    .min(1)
    .max(1000),
})
export type BulkImportPrompts = z.infer<typeof BulkImportPromptsSchema>

export const GeneratePromptsSchema = z.object({
  count: z.number().int().min(1).max(100),
  context: z.string().optional(),
})
export type GeneratePrompts = z.infer<typeof GeneratePromptsSchema>

export const PromptSchema = z.object({
  id: z.string(),
  text: z.string(),
  status: PromptStatusEnum,
  source: z.string(),
  projectId: z.string(),
  clusterId: z.string().nullable(),
  createdAt: z.string().datetime(),
})
export type Prompt = z.infer<typeof PromptSchema>
