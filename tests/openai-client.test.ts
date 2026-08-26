import type OpenAI from "openai";
import { describe, expect, it } from "vitest";
import { OpenAiStructuredOutputClient } from "../src/integrations/openai.js";

describe("OpenAI structured output client", () => {
  it("returns parsed data with provider telemetry", async () => {
    const fakeClient = {
      responses: {
        async create() {
          return {
            output_text: '{"ok":true}',
            _request_id: "req_openai_fixture",
            usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 },
          };
        },
      },
    } as unknown as OpenAI;
    const client = new OpenAiStructuredOutputClient("unused", "fixture-model", fakeClient);
    const result = await client.generateWithMetadata<{ ok: boolean }>({
      name: "fixture",
      schema: { type: "object", additionalProperties: false, properties: { ok: { type: "boolean" } }, required: ["ok"] },
      instructions: "Return fixture data.",
      input: "fixture",
    });
    expect(result.data).toEqual({ ok: true });
    expect(result.telemetry).toMatchObject({
      providerRequestId: "req_openai_fixture",
      inputTokens: 12,
      outputTokens: 8,
      totalTokens: 20,
    });
    expect(result.telemetry.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

