export interface PromptGenerationJob {
  projectId: string;
  count: number;
  context?: string;
  orgId: string;
}

export interface EmbeddingJob {
  promptIds: string[];
  orgId: string;
}

export interface ClusteringJob {
  projectId: string;
  orgId: string;
}
