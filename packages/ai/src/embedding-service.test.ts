import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      embeddings: {
        create: mockCreate,
      },
    })),
  }
})

import { EmbeddingService } from './embedding-service.js'

function makeEmbeddingResponse(count: number, dims = 1536) {
  return {
    data: Array.from({ length: count }, (_, i) => ({
      index: i,
      embedding: Array.from({ length: dims }, () => Math.random()),
    })),
  }
}

describe('EmbeddingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns correct number of embeddings', async () => {
    mockCreate.mockResolvedValueOnce(makeEmbeddingResponse(3))

    const service = new EmbeddingService({ apiKey: 'test-key' })
    const results = await service.embed(['text1', 'text2', 'text3'])

    expect(results).toHaveLength(3)
    expect(results[0]).toHaveLength(1536)
    expect(results[1]).toHaveLength(1536)
    expect(results[2]).toHaveLength(1536)
  })

  it('returns empty array for empty input', async () => {
    const service = new EmbeddingService({ apiKey: 'test-key' })
    const results = await service.embed([])

    expect(results).toEqual([])
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('batches requests for more than 2048 texts', async () => {
    const firstBatchSize = 2048
    const secondBatchSize = 100
    const totalTexts = firstBatchSize + secondBatchSize

    // Use small embedding dimensions to avoid OOM in tests
    mockCreate
      .mockResolvedValueOnce(makeEmbeddingResponse(firstBatchSize, 4))
      .mockResolvedValueOnce(makeEmbeddingResponse(secondBatchSize, 4))

    const service = new EmbeddingService({ apiKey: 'test-key' })
    const texts = Array.from({ length: totalTexts }, (_, i) => `text-${i}`)
    const results = await service.embed(texts)

    expect(results).toHaveLength(totalTexts)
    expect(mockCreate).toHaveBeenCalledTimes(2)

    // Verify first batch call
    expect(mockCreate.mock.calls[0]![0].input).toHaveLength(firstBatchSize)
    // Verify second batch call
    expect(mockCreate.mock.calls[1]![0].input).toHaveLength(secondBatchSize)
  })

  it('passes correct model and dimensions to OpenAI', async () => {
    mockCreate.mockResolvedValueOnce(makeEmbeddingResponse(1))

    const service = new EmbeddingService({ apiKey: 'test-key' })
    await service.embed(['hello'])

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: ['hello'],
      dimensions: 1536,
    })
  })
})
