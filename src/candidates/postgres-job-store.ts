import { createHash, randomUUID } from "node:crypto";
import type pg from "pg";
import type { CandidateJobStore, ClaimedCandidateJob } from "./job-store.js";
import type { CandidateEvaluation, CatalogSnapshotData } from "./types.js";

export class PostgresCandidateJobStore implements CandidateJobStore {
  constructor(private readonly pool: pg.Pool) {}

  async claim(input: Readonly<{ workerId: string; leaseSeconds: number; maxAttempts: number }>): Promise<ClaimedCandidateJob | null> {
    const result = await this.pool.query<{
      id: string;
      revision_id: string;
      correlation_id: string;
      workspace_id:string;
      attempts: number;
    }>(
      `WITH candidate AS (
         SELECT j.id,p.workspace_id FROM product_candidate_jobs j JOIN brand_profile_revisions r ON r.id=j.revision_id JOIN brand_profiles p ON p.id=r.brand_profile_id
         WHERE (
           (j.status = 'PENDING' AND j.attempts < $3 AND j.available_at <= now())
           OR (j.status = 'RUNNING' AND j.attempts <= $3 AND j.lease_expires_at <= now())
         )
         ORDER BY j.available_at, j.created_at
         FOR UPDATE OF j SKIP LOCKED LIMIT 1
       )
       UPDATE product_candidate_jobs AS job
       SET status = 'RUNNING', attempts = attempts + 1, locked_by = $1,
           lease_expires_at = now() + make_interval(secs => $2),
           started_at = COALESCE(started_at, now()),
           last_error = CASE WHEN job.status = 'RUNNING' THEN 'LEASE_EXPIRED' ELSE job.last_error END
       FROM candidate WHERE job.id = candidate.id
       RETURNING job.id, job.revision_id,candidate.workspace_id, job.correlation_id, job.attempts`,
      [input.workerId, input.leaseSeconds, input.maxAttempts],
    );
    const row = result.rows[0];
    return row ? { id: row.id, revisionId: row.revision_id, workspaceId:row.workspace_id,correlationId: row.correlation_id, attempt: row.attempts } : null;
  }

  async loadApprovedProfile(revisionId: string): Promise<Record<string, unknown>> {
    const result = await this.pool.query<{ profile_data: Record<string, unknown> }>(
      "SELECT profile_data FROM brand_profile_revisions WHERE id = $1 AND status = 'APPROVED'",
      [revisionId],
    );
    const row = result.rows[0];
    if (!row) throw Object.assign(new Error("Approved Brand Profile revision was not found"), { status: 422 });
    return row.profile_data;
  }

  async extendLease(input: Readonly<{ jobId: string; workerId: string; leaseSeconds: number }>): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE product_candidate_jobs
       SET lease_expires_at = now() + make_interval(secs => $3)
       WHERE id = $1 AND status = 'RUNNING' AND locked_by = $2 AND lease_expires_at > now()`,
      [input.jobId, input.workerId, input.leaseSeconds],
    );
    return result.rowCount === 1;
  }

  async complete(input: Readonly<{
    job: ClaimedCandidateJob;
    workerId: string;
    snapshot: CatalogSnapshotData;
    evaluations: readonly CandidateEvaluation[];
  }>): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const owned = await client.query(
        "SELECT id FROM product_candidate_jobs WHERE id = $1 AND status = 'RUNNING' AND locked_by = $2 FOR UPDATE",
        [input.job.id, input.workerId],
      );
      if (!owned.rowCount) {
        await client.query("ROLLBACK");
        return false;
      }
      const snapshotId = randomUUID();
      const serializedSnapshot = JSON.stringify({ ...input.snapshot, fetchedAt: input.snapshot.fetchedAt.toISOString() });
      const checksum = createHash("sha256").update(serializedSnapshot).digest("hex");
      await client.query(
        `INSERT INTO catalog_snapshots (id, provider, currency, product_count, checksum, data, fetched_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
        [snapshotId, input.snapshot.provider, input.snapshot.currency, input.snapshot.products.length, checksum, serializedSnapshot, input.snapshot.fetchedAt],
      );
      for (const evaluation of input.evaluations) {
        await client.query(
          `INSERT INTO product_candidates
            (id, job_id, catalog_snapshot_id, external_product_id, product_type, product_name,
             eligibility, exclusion_reasons, score, score_breakdown, evidence,
             recommended_retail_minor, variable_cost_minor, currency, margin_basis_points, rule_version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb, $11::jsonb, $12, $13, $14, $15, $16)`,
          [
            randomUUID(), input.job.id, snapshotId, evaluation.product.externalProductId,
            evaluation.product.productType, evaluation.product.name, evaluation.eligibility,
            JSON.stringify(evaluation.exclusionReasons), evaluation.score,
            evaluation.scoreBreakdown ? JSON.stringify(evaluation.scoreBreakdown) : null,
            JSON.stringify(evaluation.evidence), evaluation.recommendedRetailMinor,
            evaluation.variableCostMinor, evaluation.product.currency, evaluation.marginBasisPoints,
            evaluation.ruleVersion,
          ],
        );
      }
      const completed = await client.query(
        `UPDATE product_candidate_jobs
         SET status = 'SUCCEEDED', catalog_snapshot_id = $3, finished_at = now(), locked_by = NULL, lease_expires_at = NULL
         WHERE id = $1 AND status = 'RUNNING' AND locked_by = $2 AND lease_expires_at > now()`,
        [input.job.id, input.workerId, snapshotId],
      );
      if (completed.rowCount !== 1) {
        await client.query("ROLLBACK");
        return false;
      }
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async retry(input: Readonly<{ jobId: string; workerId: string; errorCode: string; delayMs: number }>): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE product_candidate_jobs SET status = 'PENDING', available_at = now() + make_interval(secs => $4 / 1000.0),
       last_error = $3, locked_by = NULL, lease_expires_at = NULL
       WHERE id = $1 AND status = 'RUNNING' AND locked_by = $2`,
      [input.jobId, input.workerId, input.errorCode, input.delayMs],
    );
    return result.rowCount === 1;
  }
  async deferConnection(input:Readonly<{jobId:string;workerId:string;delayMs:number}>):Promise<boolean>{const result=await this.pool.query(`UPDATE product_candidate_jobs SET status='PENDING',attempts=GREATEST(0,attempts-1),available_at=now()+make_interval(secs=>$3/1000.0),last_error='WAITING_FOR_PRINTFUL_CONNECTION',locked_by=NULL,lease_expires_at=NULL WHERE id=$1 AND status='RUNNING' AND locked_by=$2`,[input.jobId,input.workerId,input.delayMs]);return result.rowCount===1}
  async deferRateLimit(input:Readonly<{jobId:string;workerId:string;delayMs:number}>):Promise<boolean>{const result=await this.pool.query(`UPDATE product_candidate_jobs SET status='PENDING',attempts=GREATEST(0,attempts-1),available_at=now()+make_interval(secs=>$3/1000.0),last_error='WAITING_FOR_PRINTFUL_RATE_LIMIT',locked_by=NULL,lease_expires_at=NULL WHERE id=$1 AND status='RUNNING' AND locked_by=$2`,[input.jobId,input.workerId,input.delayMs]);return result.rowCount===1}

  async fail(input: Readonly<{ jobId: string; workerId: string; errorCode: string }>): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE product_candidate_jobs SET status = 'FAILED', last_error = $3, finished_at = now(), locked_by = NULL, lease_expires_at = NULL
       WHERE id = $1 AND status = 'RUNNING' AND locked_by = $2`,
      [input.jobId, input.workerId, input.errorCode],
    );
    return result.rowCount === 1;
  }
}
