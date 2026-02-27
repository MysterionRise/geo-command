import { Worker, type ConnectionOptions } from "bullmq";
import { connection } from "@geo-command/queue";
import { processEmbeddingJob } from "./processors/embedding.js";
import { processClusteringJob } from "./processors/clustering.js";

// Cast needed due to potential ioredis version mismatch between packages
const conn = connection as unknown as ConnectionOptions;

const embeddingWorker = new Worker("embedding", processEmbeddingJob, {
  connection: conn,
  concurrency: 3,
});

const clusteringWorker = new Worker("clustering", processClusteringJob, {
  connection: conn,
  concurrency: 1,
});

console.log("[worker] Embedding and clustering workers started");

embeddingWorker.on("completed", (job) => {
  console.log(`[worker] Embedding job ${job.id} completed`);
});

embeddingWorker.on("failed", (job, err) => {
  console.error(`[worker] Embedding job ${job?.id} failed:`, err.message);
});

clusteringWorker.on("completed", (job) => {
  console.log(`[worker] Clustering job ${job.id} completed`);
});

clusteringWorker.on("failed", (job, err) => {
  console.error(`[worker] Clustering job ${job?.id} failed:`, err.message);
});

async function shutdown() {
  console.log("[worker] Shutting down gracefully...");
  await Promise.all([embeddingWorker.close(), clusteringWorker.close()]);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
