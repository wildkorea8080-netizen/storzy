import type pg from "pg";
import {randomUUID} from "node:crypto";
import {DomainError} from "../brand/errors.js";

type Level="DUE_SOON"|"OVERDUE"|"FAILED";

export class PrivacySlaAlertService{
  constructor(private readonly pool:pg.Pool){}

  async list(input:{workspaceId?:string;status?:"OPEN"|"ACKNOWLEDGED"|"RESOLVED";limit?:number}={}){const limit=Math.min(Math.max(input.limit??50,1),100),values:unknown[]=[];let where="WHERE true";if(input.workspaceId){values.push(input.workspaceId);where+=` AND a.workspace_id=$${values.length}`;}if(input.status){values.push(input.status);where+=` AND a.status=$${values.length}`;}else where+=" AND a.status IN('OPEN','ACKNOWLEDGED')";values.push(limit);const found=await this.pool.query(`SELECT a.id,a.request_id,a.workspace_id,a.level,a.status,a.due_at,a.opened_at,a.acknowledged_at,a.acknowledged_by,a.resolved_at,r.request_type,r.shop_domain,d.status delivery_status,d.attempts delivery_attempts,d.response_status delivery_response_status,d.last_error delivery_last_error,d.sent_at delivery_sent_at FROM privacy_sla_alerts a JOIN shopify_privacy_requests r ON r.id=a.request_id LEFT JOIN privacy_alert_deliveries d ON d.alert_id=a.id ${where} ORDER BY CASE a.level WHEN 'OVERDUE' THEN 0 WHEN 'FAILED' THEN 1 ELSE 2 END,a.due_at LIMIT $${values.length}`,values);return found.rows;}

  async acknowledge(input:{id:string;actorId:string;workspaceId?:string}){const actorId=input.actorId.trim();if(!actorId)throw new Error("actorId is required");const values:unknown[]=[input.id,actorId];let boundary="";if(input.workspaceId){values.push(input.workspaceId);boundary=" AND workspace_id=$3";}const saved=await this.pool.query(`UPDATE privacy_sla_alerts SET status='ACKNOWLEDGED',acknowledged_at=now(),acknowledged_by=$2 WHERE id=$1${boundary} AND status='OPEN' RETURNING id,request_id,workspace_id,level,status,due_at,opened_at,acknowledged_at,acknowledged_by,resolved_at`,values);return saved.rows[0]??null;}

  async requeueDelivery(input:{alertId:string;actorId:string;reason:string;workspaceId?:string}){const actorId=input.actorId.trim(),reason=input.reason.trim();if(!actorId)throw new DomainError("INVALID_INPUT","담당자 ID가 필요합니다.");if(reason.length<1||reason.length>500)throw new DomainError("INVALID_INPUT","재전송 사유는 1~500자여야 합니다.");const client=await this.pool.connect();try{await client.query("BEGIN");const values:unknown[]=[input.alertId];let boundary="";if(input.workspaceId){values.push(input.workspaceId);boundary=" AND a.workspace_id=$2";}const found=await client.query<{id:string;status:string;attempts:number}>(`SELECT d.id,d.status,d.attempts FROM privacy_alert_deliveries d JOIN privacy_sla_alerts a ON a.id=d.alert_id WHERE a.id=$1${boundary} AND a.status IN('OPEN','ACKNOWLEDGED') FOR UPDATE OF d`,values),delivery=found.rows[0];if(!delivery){await client.query("ROLLBACK");return null;}if(delivery.status!=="FAILED")throw new DomainError("ALERT_DELIVERY_NOT_FAILED","실패한 경보 전송만 다시 대기열에 넣을 수 있습니다.");const saved=await client.query("UPDATE privacy_alert_deliveries SET status='PENDING',attempts=0,available_at=now(),locked_by=NULL,lease_expires_at=NULL,response_status=NULL,last_error=NULL WHERE id=$1 RETURNING id,alert_id,status,attempts,available_at",[delivery.id]);await client.query("INSERT INTO privacy_alert_delivery_actions(id,delivery_id,action,actor_id,reason,before_status,after_status,before_attempts) VALUES($1,$2,'REQUEUE',$3,$4,$5,'PENDING',$6)",[randomUUID(),delivery.id,actorId,reason,delivery.status,delivery.attempts]);await client.query("COMMIT");return saved.rows[0];}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}}

  async scan(now=new Date()){
    const client=await this.pool.connect();
    try{
      await client.query("BEGIN");
      const created:Record<Level,number>={DUE_SOON:0,OVERDUE:0,FAILED:0};
      const rules:Array<[Level,string]>=[
        ["DUE_SOON","status IN ('PENDING','IN_PROGRESS','FAILED') AND due_at >= $1::timestamptz AND due_at < $1::timestamptz + interval '7 days'"],
        ["OVERDUE","status IN ('PENDING','IN_PROGRESS','FAILED') AND due_at < $1::timestamptz"],
        ["FAILED","status='FAILED' AND $1::timestamptz IS NOT NULL"],
      ];
      for(const [level,condition] of rules){
        const inserted=await client.query<{id:string}>(`INSERT INTO privacy_sla_alerts(id,request_id,workspace_id,level,due_at) SELECT gen_random_uuid(),id,workspace_id,$2,due_at FROM shopify_privacy_requests WHERE ${condition} ON CONFLICT(request_id,level) DO NOTHING RETURNING id`,[now,level]);
        created[level]=inserted.rowCount??inserted.rows.length;
      }
      const resolved=await client.query(`UPDATE privacy_sla_alerts a SET status='RESOLVED',resolved_at=$1::timestamptz FROM shopify_privacy_requests r WHERE r.id=a.request_id AND a.status IN('OPEN','ACKNOWLEDGED') AND NOT(CASE a.level WHEN 'DUE_SOON' THEN r.status IN('PENDING','IN_PROGRESS','FAILED') AND r.due_at >= $1::timestamptz AND r.due_at < $1::timestamptz + interval '7 days' WHEN 'OVERDUE' THEN r.status IN('PENDING','IN_PROGRESS','FAILED') AND r.due_at < $1::timestamptz WHEN 'FAILED' THEN r.status='FAILED' ELSE false END)`,[now]);
      await client.query("COMMIT");
      return{created,totalCreated:Object.values(created).reduce((sum,value)=>sum+value,0),resolved:resolved.rowCount??0,scannedAt:now.toISOString()};
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }
}
