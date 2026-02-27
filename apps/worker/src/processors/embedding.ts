import type { Job, Queue } from "bullmq";
import { EmbeddingService } from "@geo-command/ai";
import { prisma } from "@geo-command/db";
import { clusteringQueue as _clusteringQueue } from "@geo-command/queue";
import type { EmbeddingJob, ClusteringJob } from "@geo-command/queue";

// Cast needed due to ioredis version mismatch in transitive deps
const clusteringQueue = _clusteringQueue as unknown as Queue<ClusteringJob>;

const embeddingService = new EmbeddingService();

export async function processEmbeddingJob(job: Job<EmbeddingJob>) {
  const { promptIds, orgId } = job.data;

  const prompts = await prisma.prompt.findMany({
    where: { id: { in: promptIds } },
    select: { id: true, text: true, projectId: true },
  });

  if (prompts.length === 0) {
    return;
  }

  const texts = prompts.map((p) => p.text);
  const embeddings = await embeddingService.embed(texts);

  await prisma.$transaction(
    prompts.map((prompt, i) =>
      prisma.prompt.update({
        where: { id: prompt.id },
        data: { embedding: embeddings[i]! },
      }),
    ),
  );

  // Check if all prompts in the project now have embeddings
  const projectId = prompts[0]!.projectId;
  const missingEmbeddings = await prisma.prompt.count({
    where: {
      projectId,
      embedding: { isEmpty: true },
    },
  });

  if (missingEmbeddings === 0) {
    await clusteringQueue.add("cluster", { projectId, orgId });
  }
}
