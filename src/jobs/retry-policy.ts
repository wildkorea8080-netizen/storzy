import { SchemaValidationError } from "../ai/schema-registry.js";

export type FailureDisposition = Readonly<{
  retryable: boolean;
  code: string;
}>;

type ErrorLike = {
  status?: unknown;
  code?: unknown;
  name?: unknown;
};

export function classifyGenerationError(error: unknown): FailureDisposition {
  if (error instanceof SchemaValidationError) return { retryable: false, code: "SCHEMA_VALIDATION_FAILED" };
  const candidate = (error && typeof error === "object" ? error : {}) as ErrorLike;
  const status = typeof candidate.status === "number" ? candidate.status : null;
  const code = typeof candidate.code === "string" ? candidate.code : null;
  const name = typeof candidate.name === "string" ? candidate.name : error instanceof Error ? error.name : null;

  if (status === 408 || status === 409 || status === 429 || (status !== null && status >= 500)) {
    return { retryable: true, code: `OPENAI_HTTP_${status}` };
  }
  if (["APIConnectionError", "APIConnectionTimeoutError", "AbortError", "ECONNRESET", "ETIMEDOUT"].includes(name ?? "") ||
      ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"].includes(code ?? "")) {
    return { retryable: true, code: code ?? name ?? "TRANSIENT_CONNECTION_ERROR" };
  }
  if (status !== null && status >= 400) return { retryable: false, code: `OPENAI_HTTP_${status}` };
  return { retryable: false, code: "GENERATION_FAILED" };
}

export function generationBackoffMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(5_000 * 2 ** Math.max(0, attempt - 1), 300_000);
  const jitterMultiplier = 0.8 + random() * 0.4;
  return Math.round(base * jitterMultiplier);
}

