import { describe, it, expect } from 'vitest'
import { CreatePromptSchema, BulkImportPromptsSchema, GeneratePromptsSchema } from './prompts.js'

describe('CreatePromptSchema', () => {
  it('accepts valid data with text only', () => {
    const result = CreatePromptSchema.safeParse({ text: 'Hello world' })
    expect(result.success).toBe(true)
  })

  it('rejects empty text', () => {
    const result = CreatePromptSchema.safeParse({ text: '' })
    expect(result.success).toBe(false)
  })

  it('rejects text longer than 500 characters', () => {
    const result = CreatePromptSchema.safeParse({ text: 'a'.repeat(501) })
    expect(result.success).toBe(false)
  })

  it('accepts text at max length (500)', () => {
    const result = CreatePromptSchema.safeParse({ text: 'a'.repeat(500) })
    expect(result.success).toBe(true)
  })

  it('accepts valid status DRAFT', () => {
    const result = CreatePromptSchema.safeParse({ text: 'Hello', status: 'DRAFT' })
    expect(result.success).toBe(true)
  })

  it('accepts valid status ACTIVE', () => {
    const result = CreatePromptSchema.safeParse({ text: 'Hello', status: 'ACTIVE' })
    expect(result.success).toBe(true)
  })

  it('accepts valid status ARCHIVED', () => {
    const result = CreatePromptSchema.safeParse({ text: 'Hello', status: 'ARCHIVED' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status value', () => {
    const result = CreatePromptSchema.safeParse({ text: 'Hello', status: 'INVALID' })
    expect(result.success).toBe(false)
  })

  it('treats status as optional', () => {
    const result = CreatePromptSchema.safeParse({ text: 'Hello' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBeUndefined()
    }
  })
})

describe('BulkImportPromptsSchema', () => {
  it('accepts valid prompts array', () => {
    const result = BulkImportPromptsSchema.safeParse({
      prompts: [{ text: 'Prompt 1' }, { text: 'Prompt 2' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty prompts array', () => {
    const result = BulkImportPromptsSchema.safeParse({ prompts: [] })
    expect(result.success).toBe(false)
  })

  it('rejects missing prompts field', () => {
    const result = BulkImportPromptsSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('requires text field on each item', () => {
    const result = BulkImportPromptsSchema.safeParse({
      prompts: [{ notText: 'oops' }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts array at max size (1000)', () => {
    const prompts = Array.from({ length: 1000 }, (_, i) => ({ text: `Prompt ${i}` }))
    const result = BulkImportPromptsSchema.safeParse({ prompts })
    expect(result.success).toBe(true)
  })

  it('rejects array exceeding max size (1001)', () => {
    const prompts = Array.from({ length: 1001 }, (_, i) => ({ text: `Prompt ${i}` }))
    const result = BulkImportPromptsSchema.safeParse({ prompts })
    expect(result.success).toBe(false)
  })
})

describe('GeneratePromptsSchema', () => {
  it('accepts valid count', () => {
    const result = GeneratePromptsSchema.safeParse({ count: 10 })
    expect(result.success).toBe(true)
  })

  it('accepts count with optional context', () => {
    const result = GeneratePromptsSchema.safeParse({ count: 5, context: 'some context' })
    expect(result.success).toBe(true)
  })

  it('rejects count of 0', () => {
    const result = GeneratePromptsSchema.safeParse({ count: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects count of 101', () => {
    const result = GeneratePromptsSchema.safeParse({ count: 101 })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer count', () => {
    const result = GeneratePromptsSchema.safeParse({ count: 5.5 })
    expect(result.success).toBe(false)
  })

  it('accepts count at min boundary (1)', () => {
    const result = GeneratePromptsSchema.safeParse({ count: 1 })
    expect(result.success).toBe(true)
  })

  it('accepts count at max boundary (100)', () => {
    const result = GeneratePromptsSchema.safeParse({ count: 100 })
    expect(result.success).toBe(true)
  })

  it('treats context as optional', () => {
    const result = GeneratePromptsSchema.safeParse({ count: 10 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.context).toBeUndefined()
    }
  })
})
