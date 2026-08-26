export type ClaimedGenerationJob = Readonly<{
  id: string;
  revisionId: string;
  attempt: number;
  lockedBy: string;
  leaseExpiresAt: Date;
}>;

export interface GenerationJobQueue {
  claim(input: Readonly<{
    workerId: string;
    leaseSeconds: number;
    maxAttempts: number;
  }>): Promise<ClaimedGenerationJob | null>;
  extendLease(input: Readonly<{
    jobId: string;
    workerId: string;
    leaseSeconds: number;
  }>): Promise<boolean>;
  retry(input: Readonly<{
    jobId: string;
    workerId: string;
    errorCode: string;
    delayMs: number;
  }>): Promise<boolean>;
  acknowledgeSuccess(input: Readonly<{ jobId: string; workerId: string }>): Promise<boolean>;
  acknowledgeFailure(input: Readonly<{ jobId: string; workerId: string; errorCode: string }>): Promise<boolean>;
}

