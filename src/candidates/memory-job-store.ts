import type { CandidateJobStore, ClaimedCandidateJob } from "./job-store.js";
import type { CandidateEvaluation, CatalogSnapshotData } from "./types.js";

export type MemoryCandidateJob = {
  id: string;
  revisionId: string;
  workspaceId:string;
  correlationId: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  attempts: number;
  lockedBy: string | null;
  leaseExpiresAt: number | null;
  availableAt: number;
  lastError: string | null;
};

export class MemoryCandidateJobStore implements CandidateJobStore {
  readonly jobs: MemoryCandidateJob[] = [];
  readonly profiles = new Map<string, Record<string, unknown>>();
  readonly completed = new Map<string, { snapshot: CatalogSnapshotData; evaluations: readonly CandidateEvaluation[] }>();
  now = () => Date.now();

  enqueue(job: Pick<MemoryCandidateJob, "id" | "revisionId" | "correlationId">&Partial<Pick<MemoryCandidateJob,"workspaceId">>): void {
    this.jobs.push({ ...job,workspaceId:job.workspaceId??"workspace-1", status: "PENDING", attempts: 0, lockedBy: null, leaseExpiresAt: null, availableAt: this.now(), lastError: null });
  }

  async claim(input: Readonly<{ workerId: string; leaseSeconds: number; maxAttempts: number }>): Promise<ClaimedCandidateJob | null> {
    const now = this.now();
    const job = this.jobs.find((candidate) =>
      (candidate.status === "PENDING" && candidate.attempts < input.maxAttempts && candidate.availableAt <= now) ||
      (candidate.status === "RUNNING" && candidate.attempts <= input.maxAttempts && (candidate.leaseExpiresAt ?? Infinity) <= now));
    if (!job) return null;
    if (job.status === "RUNNING") job.lastError = "LEASE_EXPIRED";
    job.status = "RUNNING";
    job.attempts += 1;
    job.lockedBy = input.workerId;
    job.leaseExpiresAt = now + input.leaseSeconds * 1_000;
    return { id: job.id, revisionId: job.revisionId, workspaceId:job.workspaceId,correlationId: job.correlationId, attempt: job.attempts };
  }

  async loadApprovedProfile(revisionId: string): Promise<Record<string, unknown>> {
    const profile = this.profiles.get(revisionId);
    if (!profile) throw Object.assign(new Error("Approved Brand Profile revision was not found"), { status: 422 });
    return profile;
  }

  async extendLease(input: Readonly<{ jobId: string; workerId: string; leaseSeconds: number }>): Promise<boolean> {
    const job = this.owned(input.jobId, input.workerId);
    if (!job || (job.leaseExpiresAt ?? 0) <= this.now()) return false;
    job.leaseExpiresAt = this.now() + input.leaseSeconds * 1_000;
    return true;
  }

  async complete(input: Readonly<{ job: ClaimedCandidateJob; workerId: string; snapshot: CatalogSnapshotData; evaluations: readonly CandidateEvaluation[] }>): Promise<boolean> {
    const job = this.owned(input.job.id, input.workerId);
    if (!job || (job.leaseExpiresAt ?? 0) <= this.now()) return false;
    job.status = "SUCCEEDED";
    job.lockedBy = null;
    job.leaseExpiresAt = null;
    this.completed.set(job.id, { snapshot: input.snapshot, evaluations: input.evaluations });
    return true;
  }

  async retry(input: Readonly<{ jobId: string; workerId: string; errorCode: string; delayMs: number }>): Promise<boolean> {
    const job = this.owned(input.jobId, input.workerId);
    if (!job) return false;
    job.status = "PENDING";
    job.availableAt = this.now() + input.delayMs;
    job.lastError = input.errorCode;
    job.lockedBy = null;
    job.leaseExpiresAt = null;
    return true;
  }
  async deferConnection(input:Readonly<{jobId:string;workerId:string;delayMs:number}>):Promise<boolean>{const job=this.owned(input.jobId,input.workerId);if(!job)return false;job.status="PENDING";job.attempts=Math.max(0,job.attempts-1);job.availableAt=this.now()+input.delayMs;job.lastError="WAITING_FOR_PRINTFUL_CONNECTION";job.lockedBy=null;job.leaseExpiresAt=null;return true}
  async deferRateLimit(input:Readonly<{jobId:string;workerId:string;delayMs:number}>):Promise<boolean>{const job=this.owned(input.jobId,input.workerId);if(!job)return false;job.status="PENDING";job.attempts=Math.max(0,job.attempts-1);job.availableAt=this.now()+input.delayMs;job.lastError="WAITING_FOR_PRINTFUL_RATE_LIMIT";job.lockedBy=null;job.leaseExpiresAt=null;return true}

  async fail(input: Readonly<{ jobId: string; workerId: string; errorCode: string }>): Promise<boolean> {
    const job = this.owned(input.jobId, input.workerId);
    if (!job) return false;
    job.status = "FAILED";
    job.lastError = input.errorCode;
    job.lockedBy = null;
    job.leaseExpiresAt = null;
    return true;
  }

  private owned(jobId: string, workerId: string): MemoryCandidateJob | undefined {
    return this.jobs.find((job) => job.id === jobId && job.status === "RUNNING" && job.lockedBy === workerId);
  }
}
