import { z } from 'zod'

export const AIEngineSchema = z.object({
  id: z.string(),
  provider: z.string(),
  model: z.string(),
  label: z.string(),
  isDefault: z.boolean(),
  maxTokens: z.number().int(),
  createdAt: z.string().datetime(),
})
export type AIEngine = z.infer<typeof AIEngineSchema>
