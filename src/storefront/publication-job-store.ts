import type pg from "pg";
import type { ShopifyStorePublicationPlan } from "./shopify-plan.js";

export type StorePublicationJob=Readonly<{id:string;storeDraftId:string;workspaceId:string;attempt:number;plan:ShopifyStorePublicationPlan}>;

export class StorePublicationJobStore{
  constructor(private readonly pool:pg.Pool){}

  async claim(workerId:string,leaseSeconds:number,maxAttempts:number):Promise<StorePublicationJob|null>{
    const result=await this.pool.query<{id:string;store_draft_id:string;workspace_id:string;attempts:number;request_payload:ShopifyStorePublicationPlan}>(`WITH next AS(
      SELECT j.id,d.workspace_id FROM shopify_store_publication_jobs j JOIN store_drafts d ON d.id=j.store_draft_id
      WHERE (j.status='PENDING' AND j.available_at<=now() AND j.attempts<$3)
         OR (j.status='RUNNING' AND j.lease_expires_at<=now() AND j.attempts<=$3)
      ORDER BY j.available_at,j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1)
      UPDATE shopify_store_publication_jobs j SET status='RUNNING',attempts=attempts+1,started_at=COALESCE(started_at,now()),locked_by=$1,lease_expires_at=now()+make_interval(secs=>$2),last_error=CASE WHEN j.status='RUNNING' THEN 'LEASE_EXPIRED' ELSE j.last_error END
      FROM next WHERE j.id=next.id RETURNING j.id,j.store_draft_id,next.workspace_id,j.attempts,j.request_payload`,[workerId,leaseSeconds,maxAttempts]);
    const row=result.rows[0];return row?{id:row.id,storeDraftId:row.store_draft_id,workspaceId:row.workspace_id,attempt:row.attempts,plan:row.request_payload}:null;
  }

  async success(jobId:string,workerId:string,response:unknown){const client=await this.pool.connect();try{await client.query("BEGIN");const q=await client.query<{store_draft_id:string}>("UPDATE shopify_store_publication_jobs SET status='SUCCEEDED',response_payload=$3::jsonb,finished_at=now(),locked_by=NULL,lease_expires_at=NULL WHERE id=$1 AND status='RUNNING' AND locked_by=$2 RETURNING store_draft_id",[jobId,workerId,JSON.stringify(response)]);if(!q.rows[0]){await client.query("ROLLBACK");return false}await client.query("UPDATE store_drafts SET status='PUBLISHED' WHERE id=$1 AND status='APPROVED'",[q.rows[0].store_draft_id]);await client.query("COMMIT");return true}catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}}
  async retry(jobId:string,workerId:string,error:string,delayMs:number){const q=await this.pool.query("UPDATE shopify_store_publication_jobs SET status='PENDING',last_error=$3,available_at=now()+make_interval(secs=>$4/1000.0),locked_by=NULL,lease_expires_at=NULL WHERE id=$1 AND status='RUNNING' AND locked_by=$2",[jobId,workerId,error,delayMs]);return q.rowCount===1}
  async deferConnection(jobId:string,workerId:string,delayMs=30_000){const q=await this.pool.query("UPDATE shopify_store_publication_jobs SET status='PENDING',attempts=GREATEST(0,attempts-1),last_error='WAITING_FOR_SHOPIFY_CONNECTION',available_at=now()+make_interval(secs=>$3/1000.0),locked_by=NULL,lease_expires_at=NULL WHERE id=$1 AND status='RUNNING' AND locked_by=$2",[jobId,workerId,delayMs]);return q.rowCount===1}
  async deferRateLimit(jobId:string,workerId:string,delayMs:number){const q=await this.pool.query("UPDATE shopify_store_publication_jobs SET status='PENDING',attempts=GREATEST(0,attempts-1),last_error='WAITING_FOR_SHOPIFY_RATE_LIMIT',available_at=now()+make_interval(secs=>$3/1000.0),locked_by=NULL,lease_expires_at=NULL WHERE id=$1 AND status='RUNNING' AND locked_by=$2",[jobId,workerId,delayMs]);return q.rowCount===1}
  async fail(jobId:string,workerId:string,error:string){const q=await this.pool.query("UPDATE shopify_store_publication_jobs SET status='FAILED',last_error=$3,finished_at=now(),locked_by=NULL,lease_expires_at=NULL WHERE id=$1 AND status='RUNNING' AND locked_by=$2",[jobId,workerId,error]);return q.rowCount===1}
}
