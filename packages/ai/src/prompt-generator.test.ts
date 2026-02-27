import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PromptGeneratorConfig } from './types.js'

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  }
})

import { PromptGenerator } from './prompt-generator.js'

const baseConfig: PromptGeneratorConfig = {
  brandVoice: 'Professional',
  targetAudience: 'Developers',
  keywords: ['geo', 'seo'],
  language: 'en',
  existingPrompts: [],
}

function makeToolUseResponse(prompts: { text: string; rationale: string }[]) {
  return {
    content: [
      {
        type: 'tool_use',
        name: 'store_prompts',
        input: { prompts },
      },
    ],
  }
}

describe('PromptGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('yields GeneratedPrompt objects', async () => {
    mockCreate.mockResolvedValueOnce(
      makeToolUseResponse([
        { text: 'Prompt 1', rationale: 'Reason 1' },
        { text: 'Prompt 2', rationale: 'Reason 2' },
      ])
    )

    const generator = new PromptGenerator({ apiKey: 'test-key' })
    const results: { text: string; rationale: string }[] = []

    for await (const prompt of generator.generate(baseConfig, 2)) {
      results.push(prompt)
    }

    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({ text: 'Prompt 1', rationale: 'Reason 1' })
    expect(results[1]).toEqual({ text: 'Prompt 2', rationale: 'Reason 2' })
  })

  it('generates in batches for count > 10', async () => {
    const batch1 = Array.from({ length: 10 }, (_, i) => ({
      text: `Prompt ${i + 1}`,
      rationale: `Reason ${i + 1}`,
    }))
    const batch2 = Array.from({ length: 5 }, (_, i) => ({
      text: `Prompt ${i + 11}`,
      rationale: `Reason ${i + 11}`,
    }))

    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse(batch1))
      .mockResolvedValueOnce(makeToolUseResponse(batch2))

    const generator = new PromptGenerator({ apiKey: 'test-key' })
    const results: { text: string; rationale: string }[] = []

    for await (const prompt of generator.generate(baseConfig, 15)) {
      results.push(prompt)
    }

    expect(results).toHaveLength(15)
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it('calls onProgress callback', async () => {
    mockCreate.mockResolvedValueOnce(
      makeToolUseResponse([
        { text: 'Prompt 1', rationale: 'Reason 1' },
        { text: 'Prompt 2', rationale: 'Reason 2' },
        { text: 'Prompt 3', rationale: 'Reason 3' },
      ])
    )

    const onProgress = vi.fn()
    const generator = new PromptGenerator({ apiKey: 'test-key' })

    const results: { text: string; rationale: string }[] = []
    for await (const prompt of generator.generate(baseConfig, 3, onProgress)) {
      results.push(prompt)
    }

    expect(onProgress).toHaveBeenCalledWith(3, 3)
  })

  it('calls API with correct model and tool configuration', async () => {
    mockCreate.mockResolvedValueOnce(
      makeToolUseResponse([{ text: 'Prompt 1', rationale: 'Reason 1' }])
    )

    const generator = new PromptGenerator({ apiKey: 'test-key', model: 'claude-test-model' })
    const results: { text: string; rationale: string }[] = []

    for await (const prompt of generator.generate(baseConfig, 1)) {
      results.push(prompt)
    }

    expect(mockCreate).toHaveBeenCalledTimes(1)
    const callArgs = mockCreate.mock.calls[0]![0]
    expect(callArgs.model).toBe('claude-test-model')
    expect(callArgs.tools).toBeDefined()
    expect(callArgs.tool_choice).toEqual({ type: 'tool', name: 'store_prompts' })
  })
})
