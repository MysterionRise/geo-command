import { describe, it, expect, vi } from 'vitest'

vi.mock('ml-kmeans', () => {
  return {
    kmeans: vi.fn().mockImplementation((data: number[][], k: number) => {
      // Simple mock: assign each point to cluster index % k
      const clusters = data.map((_, i) => i % k)
      const centroids = Array.from({ length: k }, (_, c) => {
        const members = data.filter((_, i) => i % k === c)
        if (members.length === 0) return data[0] ?? []
        return members[0]!
      })
      return { clusters, centroids }
    }),
  }
})

import { ClusteringService } from './clustering-service.js'

describe('ClusteringService', () => {
  it('returns clusters with labels, centroids, and promptIndices', () => {
    const embeddings = [
      [1, 0, 0],
      [0, 1, 0],
      [1, 0.1, 0],
      [0, 1, 0.1],
      [1, 0, 0.1],
      [0, 1.1, 0],
    ]
    const labels = ['a', 'b', 'c', 'd', 'e', 'f']

    const service = new ClusteringService()
    const result = service.cluster(embeddings, labels)

    expect(result.clusters).toBeDefined()
    expect(result.clusters.length).toBeGreaterThan(0)

    for (const cluster of result.clusters) {
      expect(cluster).toHaveProperty('label')
      expect(typeof cluster.label).toBe('string')
      expect(cluster).toHaveProperty('centroid')
      expect(Array.isArray(cluster.centroid)).toBe(true)
      expect(cluster).toHaveProperty('promptIndices')
      expect(Array.isArray(cluster.promptIndices)).toBe(true)
    }

    // All indices should be accounted for
    const allIndices = result.clusters.flatMap((c) => c.promptIndices).sort((a, b) => a - b)
    expect(allIndices).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('returns a single cluster for single item input', () => {
    const embeddings = [[1, 2, 3]]
    const labels = ['only-one']

    const service = new ClusteringService()
    const result = service.cluster(embeddings, labels)

    expect(result.clusters).toHaveLength(1)
    expect(result.clusters[0]!.label).toBe('only-one')
    expect(result.clusters[0]!.centroid).toEqual([1, 2, 3])
    expect(result.clusters[0]!.promptIndices).toEqual([0])
  })

  it('handles empty input', () => {
    const service = new ClusteringService()
    const result = service.cluster([], [])

    expect(result.clusters).toHaveLength(1)
    expect(result.clusters[0]!.label).toBe('')
    expect(result.clusters[0]!.centroid).toEqual([])
    expect(result.clusters[0]!.promptIndices).toEqual([])
  })

  it('handles two items (returns single cluster when maxK < minK)', () => {
    const embeddings = [
      [1, 0],
      [0, 1],
    ]
    const labels = ['first', 'second']

    const service = new ClusteringService()
    const result = service.cluster(embeddings, labels)

    // sqrt(2) = 1.41, floor = 1, so maxK=1 < minK=2 => single cluster
    expect(result.clusters).toHaveLength(1)
    expect(result.clusters[0]!.promptIndices).toEqual([0, 1])
  })

  it('handles three items (floor(sqrt(3))=1, still single cluster)', () => {
    const embeddings = [
      [1, 0],
      [0, 1],
      [1, 1],
    ]
    const labels = ['a', 'b', 'c']

    const service = new ClusteringService()
    const result = service.cluster(embeddings, labels)

    // sqrt(3) = 1.73, floor = 1, maxK=1 < minK=2 => single cluster
    expect(result.clusters).toHaveLength(1)
    expect(result.clusters[0]!.promptIndices).toEqual([0, 1, 2])
  })
})
