import OpenAI from "openai";
import { toOpenAiSchema } from "../ai/schema-registry.js";

export type StructuredGenerationInput = Readonly<{
  name: string;
  schema: Record<string, unknown>;
  instructions: string;
  input: string;
}>;

export type StructuredGenerationResult<T> = Readonly<{
  data: T;
  telemetry: Readonly<{
    providerRequestId: string | null;
    latencyMs: number;
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  }>;
}>;

export class OpenAiStructuredOutputClient {
  readonly #client: OpenAI;
  readonly #model: string;

  constructor(apiKey: string, model: string, client?: OpenAI) {
    this.#client = client ?? new OpenAI({ apiKey });
    this.#model = model;
  }

  async generate<T>(request: StructuredGenerationInput): Promise<T> {
    return (await this.generateWithMetadata<T>(request)).data;
  }

  async generateWithMetadata<T>(request: StructuredGenerationInput): Promise<StructuredGenerationResult<T>> {
    const startedAt = performance.now();
    const response = await this.#client.responses.create({
      model: this.#model,
      instructions: request.instructions,
      input: request.input,
      text: {
        format: {
          type: "json_schema",
          name: request.name,
          strict: true,
          schema: toOpenAiSchema(request.schema),
        },
      },
    });

    if (!response.output_text) throw new Error("OpenAI returned no structured output text");
    const usage = response.usage;
    const responseWithRequestId = response as typeof response & { _request_id?: string };
    return {
      data: JSON.parse(response.output_text) as T,
      telemetry: {
        providerRequestId: responseWithRequestId._request_id ?? null,
        latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
        inputTokens: usage?.input_tokens ?? null,
        outputTokens: usage?.output_tokens ?? null,
        totalTokens: usage?.total_tokens ?? null,
      },
    };
  }
}
