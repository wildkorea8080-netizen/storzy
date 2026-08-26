import {randomUUID} from "node:crypto";
import type pg from "pg";
import {DomainError} from "../brand/errors.js";
import {ProviderHttpError} from "../integrations/http.js";
import {parsePrintfulOrder} from "./printful-response.js";

type Client=Readonly<{getOrder(id:string):Promise<unknown>;deleteDraftOrder(id:string):Promise<void>}>;
type Resolver=Readonly<{forWorkspace(workspaceId:string):Promise<Client>}>;

export class RemoteDraftCleanupService{
  constructor(private readonly pool:pg.Pool,private readonly clients:Resolver){}

  async list(workspaceId:string,orderId:string,limit=20){
    const result=await this.pool.query(`SELECT id,remote_order_id,actor_id,reason,created_at FROM printful_draft_cleanup_actions WHERE workspace_id=$1 AND commerce_order_id=$2 ORDER BY created_at DESC LIMIT $3`,[workspaceId,orderId,limit]);
    return result.rows;
  }

  async cleanup(input:Readonly<{workspaceId:string;orderId:string;actorId:string;reason:string;idempotencyKey:string}>){
    const actorId=input.actorId.trim(),reason=input.reason.trim();
    if(!actorId||!reason)throw new DomainError("INVALID_INPUT","담당자와 정리 사유가 필요합니다.");
    if(actorId.length>120||reason.length>500)throw new DomainError("INVALID_INPUT","담당자는 120자, 정리 사유는 500자 이하여야 합니다.");

    // The lock covers the remote side effect as well as the local audit. It prevents
    // simultaneous requests (including different idempotency keys) deleting one draft twice.
    const db=await this.pool.connect(),lockKey=`storzy:printful-draft-cleanup:${input.workspaceId}:${input.orderId}`;
    let locked=false;
    try{
      await db.query("SELECT pg_advisory_lock(hashtext($1))",[lockKey]);locked=true;
      const duplicate=await db.query("SELECT id FROM printful_draft_cleanup_actions WHERE workspace_id=$1 AND idempotency_key=$2",[input.workspaceId,input.idempotencyKey]);
      if(duplicate.rows[0])return{cleaned:true,duplicate:true};

      const found=await db.query<{job_id:string;remote_order_id:string}>(`SELECT j.id job_id,j.remote_order_id FROM printful_order_jobs j JOIN commerce_orders o ON o.id=j.commerce_order_id WHERE o.id=$1 AND o.workspace_id=$2 AND j.status='HELD' AND j.remote_order_id IS NOT NULL AND j.confirmed_response IS NULL`,[input.orderId,input.workspaceId]),job=found.rows[0];
      if(!job)throw new DomainError("NOT_FOUND","정리 가능한 Printful 원격 초안을 찾을 수 없습니다.");

      const client=await this.clients.forWorkspace(input.workspaceId);let absent=false;
      try{
        const remote=parsePrintfulOrder(await client.getOrder(job.remote_order_id));
        if(!["draft","failed","canceled","cancelled"].includes(remote.status))throw new DomainError("REMOTE_ORDER_NOT_DELETABLE",`Printful 주문 상태 ${remote.status}에서는 초안을 삭제할 수 없습니다.`);
        await client.deleteDraftOrder(job.remote_order_id);
      }catch(error){if(error instanceof ProviderHttpError&&error.status===404)absent=true;else throw error}

      await db.query("BEGIN");
      try{
        const current=await db.query("SELECT id FROM printful_order_jobs WHERE id=$1 AND status='HELD' AND remote_order_id=$2 AND confirmed_response IS NULL FOR UPDATE",[job.job_id,job.remote_order_id]);
        if(!current.rows[0])throw new DomainError("ORDER_NOT_ACTIONABLE","원격 초안 상태가 변경되어 정리를 완료할 수 없습니다.");
        await db.query("UPDATE printful_order_jobs SET remote_order_id=NULL,last_error='REMOTE_DRAFT_CLEANED' WHERE id=$1",[job.job_id]);
        await db.query("INSERT INTO printful_draft_cleanup_actions(id,workspace_id,commerce_order_id,printful_order_job_id,remote_order_id,actor_id,reason,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[randomUUID(),input.workspaceId,input.orderId,job.job_id,job.remote_order_id,actorId,reason,input.idempotencyKey]);
        await db.query("COMMIT");
      }catch(error){await db.query("ROLLBACK");throw error}
      return{cleaned:true,duplicate:false,alreadyAbsent:absent};
    }finally{
      try{if(locked)await db.query("SELECT pg_advisory_unlock(hashtext($1))",[lockKey])}finally{db.release()}
    }
  }
}
