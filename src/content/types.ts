export type ContentJob = Readonly<{ id: string; candidateId: string; correlationId: string; attempt: number }>;
export type ContentContext = Readonly<{
  profile: Record<string, unknown>;
  candidate: Record<string, unknown>;
  recommendedRetailMinor: number;
  currency: string;
}>;
export type ContentGeneration = Readonly<{
  data: Record<string, unknown>; promptVersion: string; model: string;
  telemetry?: Readonly<{ providerRequestId: string | null; latencyMs: number; inputTokens: number | null; outputTokens: number | null; totalTokens: number | null }>;
}>;
export interface ProductContentGenerator { generate(context: ContentContext): Promise<ContentGeneration>; }
export interface ContentJobStore {
  claim(input: Readonly<{ workerId: string; leaseSeconds: number; maxAttempts: number }>): Promise<ContentJob | null>;
  loadContext(candidateId: string): Promise<ContentContext>;
  extendLease(input: Readonly<{ jobId: string; workerId: string; leaseSeconds: number }>): Promise<boolean>;
  complete(input: Readonly<{ job: ContentJob; workerId: string; generation: ContentGeneration }>): Promise<boolean>;
  retry(input: Readonly<{ jobId: string; workerId: string; errorCode: string; delayMs: number }>): Promise<boolean>;
  fail(input: Readonly<{ jobId: string; workerId: string; errorCode: string }>): Promise<boolean>;
}
