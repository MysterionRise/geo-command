import OpenAI from "openai";
import type { IEmbeddingService } from "./types.js";

const MAX_BATCH_SIZE = 2048;
const MODEL = "text-embedding-3-small";
const DIMENSIONS = 1536;

export class EmbeddingService implements IEmbeddingService {
  private client: OpenAI;

  constructor(options?: { apiKey?: string }) {
    this.client = new OpenAI({
      apiKey: options?.apiKey,
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const results: number[][] = new Array(texts.length);

    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
      const batch = texts.slice(i, i + MAX_BATCH_SIZE);

      const response = await this.client.embeddings.create({
        model: MODEL,
        input: batch,
        dimensions: DIMENSIONS,
      });

      for (const item of response.data) {
        results[i + item.index] = item.embedding;
      }
    }

    return results;
  }
}
