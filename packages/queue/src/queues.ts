import { Queue } from "bullmq";
import { connection } from "./connection.js";
import type {
  PromptGenerationJob,
  EmbeddingJob,
  ClusteringJob,
} from "./types.js";

export const promptGenerationQueue = new Queue<PromptGenerationJob>(
  "prompt-generation",
  { connection },
);

export const embeddingQueue = new Queue<EmbeddingJob>("embedding", {
  connection,
});

export const clusteringQueue = new Queue<ClusteringJob>("clustering", {
  connection,
});
