import { describe, expect, it } from "vitest";
import { SchemaValidationError } from "../src/ai/schema-registry.js";
import { classifyGenerationError, generationBackoffMs } from "../src/jobs/retry-policy.js";

describe("generation retry policy", () => {
  it("retries rate limits, server errors, and connection timeouts", () => {
    expect(classifyGenerationError({ status: 429 })).toEqual({ retryable: true, code: "OPENAI_HTTP_429" });
    expect(classifyGenerationError({ status: 503 })).toEqual({ retryable: true, code: "OPENAI_HTTP_503" });
    expect(classifyGenerationError({ name: "APIConnectionTimeoutError" })).toEqual({
      retryable: true,
      code: "APIConnectionTimeoutError",
    });
  });

  it("does not retry schema or client errors", () => {
    expect(classifyGenerationError(new SchemaValidationError("brandProfile", []))).toEqual({
      retryable: false,
      code: "SCHEMA_VALIDATION_FAILED",
    });
    expect(classifyGenerationError({ status: 400 })).toEqual({ retryable: false, code: "OPENAI_HTTP_400" });
  });

  it("caps exponential backoff and applies bounded jitter", () => {
    expect(generationBackoffMs(1, () => 0.5)).toBe(5_000);
    expect(generationBackoffMs(2, () => 0.5)).toBe(10_000);
    expect(generationBackoffMs(20, () => 0.5)).toBe(300_000);
    expect(generationBackoffMs(1, () => 0)).toBe(4_000);
    expect(generationBackoffMs(1, () => 1)).toBe(6_000);
  });
});

