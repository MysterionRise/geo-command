import { describe, it, expect } from 'vitest'
import { CreateProjectSchema, UpdateProjectSchema, ProjectSchema } from './projects.js'

describe('CreateProjectSchema', () => {
  const validData = {
    name: 'My Project',
    slug: 'my-project',
  }

  it('accepts valid data with required fields only', () => {
    const result = CreateProjectSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('accepts valid data with all fields', () => {
    const result = CreateProjectSchema.safeParse({
      ...validData,
      description: 'A test project',
      brandVoice: 'Professional and friendly',
      targetAudience: 'Developers',
      keywords: ['geo', 'seo'],
      language: 'fr',
      engineId: 'engine-1',
    })
    expect(result.success).toBe(true)
  })

  it('rejects name that is too short', () => {
    const result = CreateProjectSchema.safeParse({ ...validData, name: 'ab' })
    expect(result.success).toBe(false)
  })

  it('rejects name that is too long', () => {
    const result = CreateProjectSchema.safeParse({ ...validData, name: 'a'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('rejects slug with uppercase letters', () => {
    const result = CreateProjectSchema.safeParse({ ...validData, slug: 'My-Project' })
    expect(result.success).toBe(false)
  })

  it('rejects slug with spaces', () => {
    const result = CreateProjectSchema.safeParse({ ...validData, slug: 'my project' })
    expect(result.success).toBe(false)
  })

  it('accepts valid slug with lowercase and hyphens', () => {
    const result = CreateProjectSchema.safeParse({ ...validData, slug: 'my-cool-project-123' })
    expect(result.success).toBe(true)
  })

  it('treats description, brandVoice, targetAudience, engineId as optional', () => {
    const result = CreateProjectSchema.safeParse(validData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBeUndefined()
      expect(result.data.brandVoice).toBeUndefined()
      expect(result.data.targetAudience).toBeUndefined()
      expect(result.data.engineId).toBeUndefined()
    }
  })

  it('defaults keywords to empty array', () => {
    const result = CreateProjectSchema.safeParse(validData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.keywords).toEqual([])
    }
  })

  it('defaults language to "en"', () => {
    const result = CreateProjectSchema.safeParse(validData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.language).toBe('en')
    }
  })
})

describe('UpdateProjectSchema', () => {
  it('is partial — all fields are optional', () => {
    const result = UpdateProjectSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts a valid partial update', () => {
    const result = UpdateProjectSchema.safeParse({ name: 'Updated Name' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Updated Name')
    }
  })

  it('still validates field constraints on provided fields', () => {
    const result = UpdateProjectSchema.safeParse({ name: 'ab' })
    expect(result.success).toBe(false)
  })
})

describe('ProjectSchema', () => {
  it('validates a full project response shape', () => {
    const result = ProjectSchema.safeParse({
      id: 'proj-1',
      name: 'My Project',
      slug: 'my-project',
      description: null,
      brandVoice: null,
      targetAudience: null,
      keywords: [],
      language: 'en',
      workspaceId: 'ws-1',
      engineId: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    const result = ProjectSchema.safeParse({ id: 'proj-1' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid datetime format', () => {
    const result = ProjectSchema.safeParse({
      id: 'proj-1',
      name: 'My Project',
      slug: 'my-project',
      description: null,
      brandVoice: null,
      targetAudience: null,
      keywords: [],
      language: 'en',
      workspaceId: 'ws-1',
      engineId: null,
      createdAt: 'not-a-date',
      updatedAt: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(false)
  })
})
