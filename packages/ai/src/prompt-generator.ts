import Anthropic from "@anthropic-ai/sdk";
import type {
  GeneratedPrompt,
  IPromptGenerator,
  PromptGeneratorConfig,
} from "./types.js";

const BATCH_SIZE = 10;

const TOOL_SCHEMA = {
  name: "store_prompts",
  description: "Store generated prompts with their rationales",
  input_schema: {
    type: "object" as const,
    properties: {
      prompts: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            text: {
              type: "string" as const,
              description: "The generated prompt text",
            },
            rationale: {
              type: "string" as const,
              description: "Why this prompt was generated and how it fits the brand",
            },
          },
          required: ["text", "rationale"],
        },
      },
    },
    required: ["prompts"],
  },
};

function buildSystemPrompt(config: PromptGeneratorConfig): string {
  const existingSection =
    config.existingPrompts.length > 0
      ? `\n\nExisting prompts to avoid duplicating:\n${config.existingPrompts.map((p) => `- ${p}`).join("\n")}`
      : "";

  return `You are a creative marketing copywriter generating prompts for geo-targeted campaigns.

Brand voice: ${config.brandVoice}
Target audience: ${config.targetAudience}
Keywords to incorporate: ${config.keywords.join(", ")}
Language: ${config.language}
${existingSection}

Generate unique, compelling prompts that match the brand voice and resonate with the target audience. Each prompt should naturally incorporate the provided keywords. Do not duplicate any existing prompts.

Use the store_prompts tool to return your results.`;
}

export class PromptGenerator implements IPromptGenerator {
  private client: Anthropic;
  private model: string;

  constructor(options?: { apiKey?: string; model?: string }) {
    this.client = new Anthropic({
      apiKey: options?.apiKey,
    });
    this.model = options?.model ?? "claude-sonnet-4-20250514";
  }

  async *generate(
    config: PromptGeneratorConfig,
    count: number,
    onProgress?: (generated: number, total: number) => void
  ): AsyncGenerator<GeneratedPrompt> {
    let generated = 0;
    const allGenerated: string[] = [...config.existingPrompts];

    while (generated < count) {
      const batchSize = Math.min(BATCH_SIZE, count - generated);

      const prompts = await this.generateBatch(config, batchSize, allGenerated);

      for (const prompt of prompts) {
        if (generated >= count) break;
        allGenerated.push(prompt.text);
        generated++;
        yield prompt;
      }

      onProgress?.(generated, count);
    }
  }

  private async generateBatch(
    config: PromptGeneratorConfig,
    batchSize: number,
    allGenerated: string[]
  ): Promise<GeneratedPrompt[]> {
    const configWithAll = {
      ...config,
      existingPrompts: allGenerated,
    };

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: buildSystemPrompt(configWithAll),
      messages: [
        {
          role: "user",
          content: `Generate exactly ${batchSize} unique prompts. Use the store_prompts tool to return them.`,
        },
      ],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "store_prompts" },
    });

    for (const block of response.content) {
      if (block.type === "tool_use" && block.name === "store_prompts") {
        const input = block.input as { prompts: GeneratedPrompt[] };
        return input.prompts;
      }
    }

    return [];
  }
}
