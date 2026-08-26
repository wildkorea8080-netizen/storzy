import type { CandidateEvaluation, CatalogSnapshotData } from "./types.js";

export type ClaimedCandidateJob = Readonly<{
  id: string;
  revisionId: string;
  workspaceId:string;
  correlationId: string;
  attempt: number;
}>;

export interface CandidateJobStore {
  claim(input: Readonly<{ workerId: string; leaseSeconds: number; maxAttempts: number }>): Promise<ClaimedCandidateJob | null>;
  loadApprovedProfile(revisionId: string): Promise<Record<string, unknown>>;
  extendLease(input: Readonly<{ jobId: string; workerId: string; leaseSeconds: number }>): Promise<boolean>;
  complete(input: Readonly<{
    job: ClaimedCandidateJob;
    workerId: string;
    snapshot: CatalogSnapshotData;
    evaluations: readonly CandidateEvaluation[];
  }>): Promise<boolean>;
  retry(input: Readonly<{ jobId: string; workerId: string; errorCode: string; delayMs: number }>): Promise<boolean>;
  deferConnection(input:Readonly<{jobId:string;workerId:string;delayMs:number}>):Promise<boolean>;
  deferRateLimit(input:Readonly<{jobId:string;workerId:string;delayMs:number}>):Promise<boolean>;
  fail(input: Readonly<{ jobId: string; workerId: string; errorCode: string }>): Promise<boolean>;
}
