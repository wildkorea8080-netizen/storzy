import type pg from "pg";

export type RateLimitDecision=Readonly<{allowed:boolean;retryAfterMs:number}>;

export class PrintfulOrderRateLimiter{
  constructor(private readonly pool:pg.Pool,private readonly capacity=2){if(!Number.isInteger(capacity)||capacity<1||capacity>120)throw new Error("Printful order rate limit must be an integer from 1 to 120")}

  async acquire(workspaceId:string):Promise<RateLimitDecision>{
    const db=await this.pool.connect();
    try{
      await db.query("BEGIN");
      await db.query(`INSERT INTO workspace_printful_order_rate_limits(workspace_id,used) VALUES($1,0) ON CONFLICT(workspace_id) DO NOTHING`,[workspaceId]);
      const found=await db.query<{expired:boolean;used:number;retry_after_ms:string}>(`SELECT window_started_at+interval '1 minute'<=now() expired,used,GREATEST(1000,CEIL(EXTRACT(EPOCH FROM(window_started_at+interval '1 minute'-now()))*1000))::bigint retry_after_ms FROM workspace_printful_order_rate_limits WHERE workspace_id=$1 FOR UPDATE`,[workspaceId]),row=found.rows[0];
      if(!row)throw new Error("Printful rate limit state was not created");
      if(row.expired){await db.query(`UPDATE workspace_printful_order_rate_limits SET window_started_at=now(),used=1,updated_at=now() WHERE workspace_id=$1`,[workspaceId]);await db.query("COMMIT");return{allowed:true,retryAfterMs:0}}
      if(row.used<this.capacity){await db.query(`UPDATE workspace_printful_order_rate_limits SET used=used+1,updated_at=now() WHERE workspace_id=$1`,[workspaceId]);await db.query("COMMIT");return{allowed:true,retryAfterMs:0}}
      await db.query("COMMIT");return{allowed:false,retryAfterMs:Number(row.retry_after_ms)};
    }catch(error){await db.query("ROLLBACK");throw error}finally{db.release()}
  }
}
