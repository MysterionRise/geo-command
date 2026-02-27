import { kmeans } from "ml-kmeans";
import type { Cluster, ClusteringResult, IClusteringService } from "./types.js";

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function silhouetteScore(
  embeddings: number[][],
  assignments: number[],
  k: number
): number {
  const n = embeddings.length;
  if (n <= k) return -1;

  let totalScore = 0;
  let scoredPoints = 0;

  for (let i = 0; i < n; i++) {
    const clusterI = assignments[i]!;
    const embeddingI = embeddings[i]!;

    // Compute average intra-cluster distance (a)
    let intraSum = 0;
    let intraCount = 0;
    for (let j = 0; j < n; j++) {
      if (j !== i && assignments[j] === clusterI) {
        intraSum += euclideanDistance(embeddingI, embeddings[j]!);
        intraCount++;
      }
    }

    if (intraCount === 0) continue;
    const a = intraSum / intraCount;

    // Compute minimum average inter-cluster distance (b)
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === clusterI) continue;
      let interSum = 0;
      let interCount = 0;
      for (let j = 0; j < n; j++) {
        if (assignments[j] === c) {
          interSum += euclideanDistance(embeddingI, embeddings[j]!);
          interCount++;
        }
      }
      if (interCount > 0) {
        b = Math.min(b, interSum / interCount);
      }
    }

    if (!isFinite(b)) continue;

    const s = (b - a) / Math.max(a, b);
    totalScore += s;
    scoredPoints++;
  }

  return scoredPoints > 0 ? totalScore / scoredPoints : -1;
}

function findClosestToCenter(
  embeddings: number[][],
  indices: number[],
  centroid: number[]
): number {
  let closestIdx = indices[0]!;
  let closestDist = Infinity;

  for (const idx of indices) {
    const embedding = embeddings[idx];
    if (!embedding) continue;
    const dist = euclideanDistance(embedding, centroid);
    if (dist < closestDist) {
      closestDist = dist;
      closestIdx = idx;
    }
  }

  return closestIdx;
}

export class ClusteringService implements IClusteringService {
  cluster(embeddings: number[][], labels: string[]): ClusteringResult {
    const n = embeddings.length;

    if (n < 2) {
      return {
        clusters: [
          {
            label: labels[0] ?? "",
            centroid: embeddings[0] ?? [],
            promptIndices: n === 1 ? [0] : [],
          },
        ],
      };
    }

    const maxK = Math.min(Math.floor(Math.sqrt(n)), 20);
    const minK = 2;

    if (maxK < minK) {
      return {
        clusters: [
          {
            label: labels[0] ?? "",
            centroid: embeddings[0] ?? [],
            promptIndices: Array.from({ length: n }, (_, i) => i),
          },
        ],
      };
    }

    let bestK = minK;
    let bestScore = -Infinity;

    for (let k = minK; k <= maxK; k++) {
      const result = kmeans(embeddings, k, { initialization: "kmeans++" });
      const score = silhouetteScore(embeddings, result.clusters, k);

      if (score > bestScore) {
        bestScore = score;
        bestK = k;
      }
    }

    const finalResult = kmeans(embeddings, bestK, { initialization: "kmeans++" });

    const clusterMap = new Map<number, number[]>();
    for (let i = 0; i < finalResult.clusters.length; i++) {
      const clusterId = finalResult.clusters[i]!;
      const existing = clusterMap.get(clusterId);
      if (existing) {
        existing.push(i);
      } else {
        clusterMap.set(clusterId, [i]);
      }
    }

    const clusters: Cluster[] = [];
    for (const [clusterId, indices] of clusterMap) {
      const centroid = finalResult.centroids[clusterId];
      if (!centroid) continue;
      const representativeIdx = findClosestToCenter(embeddings, indices, centroid);

      clusters.push({
        label: labels[representativeIdx] ?? "",
        centroid,
        promptIndices: indices,
      });
    }

    return { clusters };
  }
}
