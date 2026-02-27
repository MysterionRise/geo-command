import type { Job } from "bullmq";
import { ClusteringService } from "@geo-command/ai";
import { prisma } from "@geo-command/db";
import type { ClusteringJob } from "@geo-command/queue";

const clusteringService = new ClusteringService();

export async function processClusteringJob(job: Job<ClusteringJob>) {
  const { projectId } = job.data;

  const prompts = await prisma.prompt.findMany({
    where: {
      projectId,
      embedding: { isEmpty: false },
    },
    select: { id: true, text: true, embedding: true },
  });

  if (prompts.length < 2) {
    return;
  }

  const embeddings = prompts.map((p) => p.embedding);
  const texts = prompts.map((p) => p.text);
  const result = clusteringService.cluster(embeddings, texts);

  // Delete existing clusters for the project before upserting new ones
  await prisma.promptCluster.deleteMany({ where: { projectId } });

  for (const cluster of result.clusters) {
    const created = await prisma.promptCluster.create({
      data: {
        label: cluster.label,
        centroid: cluster.centroid,
        projectId,
      },
    });

    const promptIdsInCluster = cluster.promptIndices.map((i) => prompts[i]!.id);
    await prisma.prompt.updateMany({
      where: { id: { in: promptIdsInCluster } },
      data: { clusterId: created.id },
    });
  }
}
