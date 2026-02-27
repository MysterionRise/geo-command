export interface PromptGeneratorConfig {
  brandVoice: string;
  targetAudience: string;
  keywords: string[];
  language: string;
  existingPrompts: string[];
}

export interface GeneratedPrompt {
  text: string;
  rationale: string;
}

export interface IPromptGenerator {
  generate(
    config: PromptGeneratorConfig,
    count: number,
    onProgress?: (generated: number, total: number) => void
  ): AsyncGenerator<GeneratedPrompt>;
}

export interface IEmbeddingService {
  embed(texts: string[]): Promise<number[][]>;
}

export interface Cluster {
  label: string;
  centroid: number[];
  promptIndices: number[];
}

export interface ClusteringResult {
  clusters: Cluster[];
}

export interface IClusteringService {
  cluster(embeddings: number[][], labels: string[]): ClusteringResult;
}
