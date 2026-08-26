import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { ContentContext, ContentGeneration, ContentJob, ContentJobStore } from "./types.js";

export class PostgresContentJobStore implements ContentJobStore {
  constructor(private readonly pool: pg.Pool) {}
  async claim(input: Readonly<{ workerId: string; leaseSeconds: number; maxAttempts: number }>): Promise<ContentJob | null> {
    const result = await this.pool.query<{ id: string; candidate_id: string; correlation_id: string; attempts: number }>(
      `WITH next AS (SELECT id FROM product_content_jobs WHERE
        (status='PENDING' AND attempts < $3 AND available_at <= now()) OR
        (status='RUNNING' AND attempts <= $3 AND lease_expires_at <= now())
        ORDER BY available_at, created_at FOR UPDATE SKIP LOCKED LIMIT 1)
       UPDATE product_content_jobs j SET status='RUNNING', attempts=attempts+1, locked_by=$1,
        lease_expires_at=now()+make_interval(secs=>$2), started_at=COALESCE(started_at,now()),
        last_error=CASE WHEN j.status='RUNNING' THEN 'LEASE_EXPIRED' ELSE j.last_error END
       FROM next WHERE j.id=next.id RETURNING j.id,j.candidate_id,j.correlation_id,j.attempts`,
      [input.workerId, input.leaseSeconds, input.maxAttempts]);
    const row = result.rows[0];
    return row ? { id: row.id, candidateId: row.candidate_id, correlationId: row.correlation_id, attempt: row.attempts } : null;
  }
  async loadContext(candidateId: string): Promise<ContentContext> {
    const result = await this.pool.query<{ profile_data: Record<string, unknown>; candidate: Record<string, unknown>; recommended_retail_minor: string; currency: string }>(
      `SELECT r.profile_data, jsonb_build_object('id',c.id,'external_product_id',c.external_product_id,'product_type',c.product_type,
        'product_name',c.product_name,'score',c.score,'score_breakdown',c.score_breakdown,'evidence',c.evidence,
        'sizes',c.evidence->'sizes','colors',c.evidence->'colors') candidate,
        c.recommended_retail_minor,c.currency
       FROM product_candidates c JOIN product_candidate_jobs cj ON cj.id=c.job_id
       JOIN brand_profile_revisions r ON r.id=cj.revision_id
       WHERE c.id=$1 AND c.decision_status='APPROVED' AND r.status IN ('APPROVED','SUPERSEDED')`, [candidateId]);
    const row = result.rows[0];
    if (!row) throw Object.assign(new Error("Approved content context was not found"), { status: 422 });
    return { profile: row.profile_data, candidate: row.candidate, recommendedRetailMinor: Number(row.recommended_retail_minor), currency: row.currency };
  }
  async extendLease(input: Readonly<{ jobId: string; workerId: string; leaseSeconds: number }>): Promise<boolean> {
    const result = await this.pool.query("UPDATE product_content_jobs SET lease_expires_at=now()+make_interval(secs=>$3) WHERE id=$1 AND status='RUNNING' AND locked_by=$2 AND lease_expires_at>now()", [input.jobId,input.workerId,input.leaseSeconds]); return result.rowCount===1;
  }
  async complete(input: Readonly<{ job: ContentJob; workerId: string; generation: ContentGeneration }>): Promise<boolean> {
    const client=await this.pool.connect(); try { await client.query("BEGIN");
      const owned=await client.query("SELECT id FROM product_content_jobs WHERE id=$1 AND status='RUNNING' AND locked_by=$2 AND lease_expires_at>now() FOR UPDATE",[input.job.id,input.workerId]);
      if(!owned.rowCount){await client.query("ROLLBACK");return false;}
      const contentId=randomUUID();
      await client.query(`INSERT INTO product_contents(id,candidate_id,job_id,content_data,schema_version,prompt_version,model)
        VALUES($1,$2,$3,$4::jsonb,$5,$6,$7)`,[contentId,input.job.candidateId,input.job.id,JSON.stringify(input.generation.data),String(input.generation.data.schema_version),input.generation.promptVersion,input.generation.model]);
      await client.query(`INSERT INTO product_content_revisions(id,product_content_id,revision,content_data,source,status,created_by)
        VALUES($1,$2,1,$3::jsonb,'AI','DRAFT','ai-worker')`,[randomUUID(),contentId,JSON.stringify(input.generation.data)]);
      const t=input.generation.telemetry;
      await client.query(`UPDATE product_content_jobs SET status='SUCCEEDED',finished_at=now(),locked_by=NULL,lease_expires_at=NULL,
        provider_request_id=$3,latency_ms=$4,input_tokens=$5,output_tokens=$6,total_tokens=$7 WHERE id=$1 AND locked_by=$2`,
        [input.job.id,input.workerId,t?.providerRequestId??null,t?.latencyMs??null,t?.inputTokens??null,t?.outputTokens??null,t?.totalTokens??null]);
      await client.query("COMMIT");return true;
    } catch(error){await client.query("ROLLBACK");throw error;} finally{client.release();}
  }
  async retry(input: Readonly<{ jobId:string;workerId:string;errorCode:string;delayMs:number }>):Promise<boolean>{const r=await this.pool.query("UPDATE product_content_jobs SET status='PENDING',available_at=now()+make_interval(secs=>$4/1000.0),last_error=$3,locked_by=NULL,lease_expires_at=NULL WHERE id=$1 AND status='RUNNING' AND locked_by=$2",[input.jobId,input.workerId,input.errorCode,input.delayMs]);return r.rowCount===1;}
  async fail(input: Readonly<{ jobId:string;workerId:string;errorCode:string }>):Promise<boolean>{const r=await this.pool.query("UPDATE product_content_jobs SET status='FAILED',finished_at=now(),last_error=$3,locked_by=NULL,lease_expires_at=NULL WHERE id=$1 AND status='RUNNING' AND locked_by=$2",[input.jobId,input.workerId,input.errorCode]);return r.rowCount===1;}
}
