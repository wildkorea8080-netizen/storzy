import type pg from "pg";
import type { ClaimedGenerationJob, GenerationJobQueue } from "./types.js";

type ClaimedRow = {
  id: string;
  revision_id: string;
  attempts: number;
  locked_by: string;
  lease_expires_at: Date;
};

export class PostgresGenerationJobQueue implements GenerationJobQueue {
  constructor(private readonly pool: pg.Pool) {}

  async claim(input: Readonly<{ workerId: string; leaseSeconds: number; maxAttempts: number }>): Promise<ClaimedGenerationJob | null> {
    const result = await this.pool.query<ClaimedRow>(
      `WITH candidate AS (
         SELECT id
         FROM generation_jobs
         WHERE job_type = 'BRAND_PROFILE_GENERATION'
           AND (
             (status = 'PENDING' AND attempts < $3 AND available_at <= now())
             OR (status = 'RUNNING' AND attempts <= $3 AND lease_expires_at <= now())
           )
         ORDER BY available_at, created_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE generation_jobs AS job
       SET status = 'RUNNING',
           attempts = attempts + 1,
           locked_by = $1,
           lease_expires_at = now() + make_interval(secs => $2),
           started_at = COALESCE(started_at, now()),
           last_error = CASE WHEN job.status = 'RUNNING' THEN 'LEASE_EXPIRED' ELSE job.last_error END
       FROM candidate
       WHERE job.id = candidate.id
       RETURNING job.id, job.revision_id, job.attempts, job.locked_by, job.lease_expires_at`,
      [input.workerId, input.leaseSeconds, input.maxAttempts],
    );
    const row = result.rows[0];
    return row
      ? { id: row.id, revisionId: row.revision_id, attempt: row.attempts, lockedBy: row.locked_by, leaseExpiresAt: row.lease_expires_at }
      : null;
  }

  async extendLease(input: Readonly<{ jobId: string; workerId: string; leaseSeconds: number }>): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE generation_jobs
       SET lease_expires_at = now() + make_interval(secs => $3)
       WHERE id = $1 AND status = 'RUNNING' AND locked_by = $2 AND lease_expires_at > now()`,
      [input.jobId, input.workerId, input.leaseSeconds],
    );
    return result.rowCount === 1;
  }

  async retry(input: Readonly<{ jobId: string; workerId: string; errorCode: string; delayMs: number }>): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE generation_jobs
       SET status = 'PENDING',
           available_at = now() + make_interval(secs => $4 / 1000.0),
           last_error = $3,
           locked_by = NULL,
           lease_expires_at = NULL
       WHERE id = $1 AND status = 'RUNNING' AND locked_by = $2`,
      [input.jobId, input.workerId, input.errorCode, input.delayMs],
    );
    return result.rowCount === 1;
  }

  async acknowledgeSuccess(input: Readonly<{ jobId: string; workerId: string }>): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE generation_jobs
       SET status = 'SUCCEEDED', finished_at = COALESCE(finished_at, now()), locked_by = NULL, lease_expires_at = NULL
       WHERE id = $1 AND (
         status = 'SUCCEEDED'
         OR (status = 'RUNNING' AND locked_by = $2)
       )`,
      [input.jobId, input.workerId],
    );
    return result.rowCount === 1;
  }

  async acknowledgeFailure(input: Readonly<{ jobId: string; workerId: string; errorCode: string }>): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE generation_jobs
       SET status = 'FAILED', last_error = $3, finished_at = COALESCE(finished_at, now()), locked_by = NULL, lease_expires_at = NULL
       WHERE id = $1 AND (
         status = 'FAILED'
         OR (status = 'RUNNING' AND locked_by = $2)
       )`,
      [input.jobId, input.workerId, input.errorCode],
    );
    return result.rowCount === 1;
  }
}
