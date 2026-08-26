import type { ClaimedGenerationJob, GenerationJobQueue } from "./types.js";

type MemoryJob = {
  id: string;
  revisionId: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  attempts: number;
  availableAt: Date;
  lockedBy: string | null;
  leaseExpiresAt: Date | null;
  lastError: string | null;
};

export class MemoryGenerationJobQueue implements GenerationJobQueue {
  readonly jobs = new Map<string, MemoryJob>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  add(job: Readonly<{ id: string; revisionId: string; availableAt?: Date }>): void {
    this.jobs.set(job.id, {
      id: job.id,
      revisionId: job.revisionId,
      status: "PENDING",
      attempts: 0,
      availableAt: job.availableAt ?? this.now(),
      lockedBy: null,
      leaseExpiresAt: null,
      lastError: null,
    });
  }

  async claim(input: Readonly<{ workerId: string; leaseSeconds: number; maxAttempts: number }>): Promise<ClaimedGenerationJob | null> {
    const now = this.now();
    const job = [...this.jobs.values()]
      .filter(
        (candidate) =>
          ((candidate.status === "PENDING" && candidate.attempts < input.maxAttempts && candidate.availableAt <= now) ||
            (candidate.status === "RUNNING" &&
              candidate.attempts <= input.maxAttempts &&
              candidate.leaseExpiresAt !== null &&
              candidate.leaseExpiresAt <= now)),
      )
      .sort((left, right) => left.availableAt.getTime() - right.availableAt.getTime())[0];
    if (!job) return null;
    job.status = "RUNNING";
    job.attempts += 1;
    job.lockedBy = input.workerId;
    job.leaseExpiresAt = new Date(now.getTime() + input.leaseSeconds * 1_000);
    return { id: job.id, revisionId: job.revisionId, attempt: job.attempts, lockedBy: input.workerId, leaseExpiresAt: job.leaseExpiresAt };
  }

  async extendLease(input: Readonly<{ jobId: string; workerId: string; leaseSeconds: number }>): Promise<boolean> {
    const job = this.jobs.get(input.jobId);
    if (!job || job.status !== "RUNNING" || job.lockedBy !== input.workerId || !job.leaseExpiresAt || job.leaseExpiresAt <= this.now()) return false;
    job.leaseExpiresAt = new Date(this.now().getTime() + input.leaseSeconds * 1_000);
    return true;
  }

  async retry(input: Readonly<{ jobId: string; workerId: string; errorCode: string; delayMs: number }>): Promise<boolean> {
    const job = this.ownedRunningJob(input.jobId, input.workerId);
    if (!job) return false;
    job.status = "PENDING";
    job.availableAt = new Date(this.now().getTime() + input.delayMs);
    job.lastError = input.errorCode;
    job.lockedBy = null;
    job.leaseExpiresAt = null;
    return true;
  }

  async acknowledgeSuccess(input: Readonly<{ jobId: string; workerId: string }>): Promise<boolean> {
    const job = this.jobs.get(input.jobId);
    if (!job || (job.status !== "SUCCEEDED" && (job.status !== "RUNNING" || job.lockedBy !== input.workerId))) return false;
    job.status = "SUCCEEDED";
    job.lockedBy = null;
    job.leaseExpiresAt = null;
    return true;
  }

  async acknowledgeFailure(input: Readonly<{ jobId: string; workerId: string; errorCode: string }>): Promise<boolean> {
    const job = this.jobs.get(input.jobId);
    if (!job || (job.status !== "FAILED" && (job.status !== "RUNNING" || job.lockedBy !== input.workerId))) return false;
    job.status = "FAILED";
    job.lastError = input.errorCode;
    job.lockedBy = null;
    job.leaseExpiresAt = null;
    return true;
  }

  private ownedRunningJob(jobId: string, workerId: string): MemoryJob | null {
    const job = this.jobs.get(jobId);
    return job?.status === "RUNNING" && job.lockedBy === workerId ? job : null;
  }
}
