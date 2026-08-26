import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Pool } from "pg";

export const ADMIN_SESSION_COOKIE = "storzy_admin_session";

export type AdminSession = Readonly<{ id: string; expiresAt: string }>;
export type AdminAuthEventType="LOGIN_SUCCEEDED"|"LOGIN_FAILED"|"LOGIN_RATE_LIMITED"|"LOGOUT"|"REVOKE_SESSION"|"REVOKE_ALL"|"RETENTION_CLEANUP";

function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function cookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    const value = item.slice(separator + 1).trim();
    return /^[A-Za-z0-9_-]{20,200}$/.test(value) ? value : undefined;
  }
  return undefined;
}

export class AdminSessionService {
  readonly #ttlSeconds: number;
  readonly #secure: boolean;

  constructor(private readonly pool: Pick<Pool, "query">, options: Readonly<{ ttlSeconds?: number; secure?: boolean }> = {}) {
    this.#ttlSeconds = options.ttlSeconds ?? 8 * 60 * 60;
    if (!Number.isInteger(this.#ttlSeconds) || this.#ttlSeconds < 300 || this.#ttlSeconds > 7 * 24 * 60 * 60) {
      throw new Error("ADMIN_SESSION_TTL_SECONDS must be an integer between 300 and 604800");
    }
    this.#secure = options.secure ?? false;
  }

  async create(now = new Date()): Promise<Readonly<{ session: AdminSession; setCookie: string }>> {
    const id = randomUUID();
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + this.#ttlSeconds * 1000);
    await this.pool.query(
      "INSERT INTO admin_sessions(id,token_digest,expires_at,last_seen_at) VALUES($1,$2,$3,$4)",
      [id, digest(token), expiresAt, now],
    );
    return {
      session: { id, expiresAt: expiresAt.toISOString() },
      setCookie: `${ADMIN_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${this.#ttlSeconds}${this.#secure ? "; Secure" : ""}`,
    };
  }

  clientDigest(address: string | undefined): string { return digest(address?.trim()||"unknown"); }

  async record(eventType:AdminAuthEventType,outcome:"SUCCEEDED"|"REJECTED",clientDigest:string,options:Readonly<{sessionId?:string;detail?:Record<string,unknown>}>= {},now=new Date()):Promise<void>{
    await this.pool.query("INSERT INTO admin_auth_events(id,event_type,outcome,session_id,client_digest,detail,occurred_at) VALUES($1,$2,$3,$4,$5,$6,$7)",[randomUUID(),eventType,outcome,options.sessionId??null,clientDigest,options.detail??{},now]);
  }

  async authenticate(cookieHeader: string | undefined, now = new Date()): Promise<AdminSession | null> {
    const token = cookieValue(cookieHeader, ADMIN_SESSION_COOKIE);
    if (!token) return null;
    const result = await this.pool.query<{ id: string; expires_at: Date | string }>(
      `UPDATE admin_sessions
          SET last_seen_at=$2
        WHERE token_digest=$1 AND status='ACTIVE' AND expires_at>$2
        RETURNING id,expires_at`,
      [digest(token), now],
    );
    const row = result.rows[0];
    return row ? { id: row.id, expiresAt: new Date(row.expires_at).toISOString() } : null;
  }

  async revoke(cookieHeader: string | undefined, now = new Date()): Promise<string|null> {
    const token = cookieValue(cookieHeader, ADMIN_SESSION_COOKIE);
    if (!token)return null;
    const result=await this.pool.query<{id:string}>("UPDATE admin_sessions SET status='REVOKED',revoked_at=$2 WHERE token_digest=$1 AND status='ACTIVE' RETURNING id", [digest(token), now]);
    return result.rows[0]?.id??null;
  }

  async active(now=new Date()):Promise<ReadonlyArray<Readonly<{id:string;createdAt:string;expiresAt:string;lastSeenAt:string}>>>{const result=await this.pool.query<{id:string;created_at:Date|string;expires_at:Date|string;last_seen_at:Date|string}>("SELECT id,created_at,expires_at,last_seen_at FROM admin_sessions WHERE status='ACTIVE' AND expires_at>$1 ORDER BY last_seen_at DESC LIMIT 100",[now]);return result.rows.map(row=>({id:row.id,createdAt:new Date(row.created_at).toISOString(),expiresAt:new Date(row.expires_at).toISOString(),lastSeenAt:new Date(row.last_seen_at).toISOString()}));}

  async events(limit=50):Promise<ReadonlyArray<Record<string,unknown>>>{const result=await this.pool.query("SELECT id,event_type,outcome,session_id,client_digest,detail,occurred_at FROM admin_auth_events ORDER BY occurred_at DESC LIMIT $1",[limit]);return result.rows.map(row=>({...row,client_digest:String(row.client_digest).slice(0,12),occurred_at:new Date(row.occurred_at as Date|string).toISOString()}));}
  async alerts(limit=50):Promise<ReadonlyArray<Record<string,unknown>>>{const result=await this.pool.query("SELECT id,alert_type,client_digest,resolution_status,status delivery_status,attempts,response_status,last_error,sent_at,created_at FROM admin_security_alerts ORDER BY created_at DESC LIMIT $1",[limit]);return result.rows.map(row=>({...row,client_digest:String(row.client_digest).slice(0,12)}));}
  async actAlert(input:Readonly<{id:string;action:"ACKNOWLEDGE"|"RESOLVE";actorId:string;reason:string}>):Promise<Record<string,unknown>|null>{const actor=input.actorId.trim(),reason=input.reason.trim();if(!actor||reason.length<1||reason.length>500)throw new Error("actorId and a 1~500 character reason are required");const target=input.action==="ACKNOWLEDGE"?"ACKNOWLEDGED":"RESOLVED",client=await (this.pool as Pool).connect();try{await client.query("BEGIN");const found=await client.query<{resolution_status:string;attempts:number}>("SELECT resolution_status,attempts FROM admin_security_alerts WHERE id=$1 FOR UPDATE",[input.id]),row=found.rows[0];if(!row){await client.query("ROLLBACK");return null;}const saved=await client.query(`UPDATE admin_security_alerts SET resolution_status=$2,acknowledged_at=CASE WHEN $2='ACKNOWLEDGED' THEN now() ELSE acknowledged_at END,resolved_at=CASE WHEN $2='RESOLVED' THEN now() ELSE NULL END WHERE id=$1 RETURNING id,resolution_status`,[input.id,target]);await client.query("INSERT INTO admin_security_alert_actions(id,alert_id,action,actor_id,reason,before_status,after_status,before_attempts) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[randomUUID(),input.id,input.action,actor,reason,row.resolution_status,target,row.attempts]);await client.query("COMMIT");return saved.rows[0]??null;}catch(error){await client.query("ROLLBACK");throw error}finally{client.release();}}
  async requeueAlert(input:Readonly<{id:string;actorId:string;reason:string}>):Promise<Record<string,unknown>|null>{const actor=input.actorId.trim(),reason=input.reason.trim();if(!actor||reason.length<1||reason.length>500)throw new Error("actorId and a 1~500 character reason are required");const client=await (this.pool as Pool).connect();try{await client.query("BEGIN");const found=await client.query<{status:string;attempts:number}>("SELECT status,attempts FROM admin_security_alerts WHERE id=$1 FOR UPDATE",[input.id]),row=found.rows[0];if(!row){await client.query("ROLLBACK");return null;}if(row.status!=="FAILED")throw new Error("Only failed security alert deliveries can be requeued");const saved=await client.query("UPDATE admin_security_alerts SET status='PENDING',attempts=0,available_at=now(),locked_by=NULL,lease_expires_at=NULL,response_status=NULL,last_error=NULL WHERE id=$1 RETURNING id,status,attempts",[input.id]);await client.query("INSERT INTO admin_security_alert_actions(id,alert_id,action,actor_id,reason,before_status,after_status,before_attempts) VALUES($1,$2,'REQUEUE',$3,$4,$5,'PENDING',$6)",[randomUUID(),input.id,actor,reason,row.status,row.attempts]);await client.query("COMMIT");return saved.rows[0]??null;}catch(error){await client.query("ROLLBACK");throw error}finally{client.release();}}
  async alertActions(id:string):Promise<ReadonlyArray<Record<string,unknown>>>{return(await this.pool.query("SELECT id,action,actor_id,reason,before_status,after_status,before_attempts,created_at FROM admin_security_alert_actions WHERE alert_id=$1 ORDER BY created_at DESC LIMIT 100",[id])).rows;}

  async revokeAll(now=new Date()):Promise<number>{const result=await this.pool.query("UPDATE admin_sessions SET status='REVOKED',revoked_at=$1 WHERE status='ACTIVE' AND expires_at>$1",[now]);return result.rowCount??0;}

  async revokeById(id:string,now=new Date()):Promise<boolean>{const result=await this.pool.query("UPDATE admin_sessions SET status='REVOKED',revoked_at=$2 WHERE id=$1 AND status='ACTIVE' RETURNING id",[id,now]);return Boolean(result.rows[0]);}

  async cleanup(options:Readonly<{eventRetentionDays?:number;sessionRetentionDays?:number}>={},now=new Date()):Promise<Readonly<{deletedEvents:number;deletedSessions:number}>>{const eventDays=options.eventRetentionDays??90,sessionDays=options.sessionRetentionDays??30;if(!Number.isInteger(eventDays)||eventDays<30||eventDays>730||!Number.isInteger(sessionDays)||sessionDays<1||sessionDays>365)throw new Error("Invalid admin authentication retention policy");const eventCutoff=new Date(now.getTime()-eventDays*86400000),sessionCutoff=new Date(now.getTime()-sessionDays*86400000);const events=await this.pool.query("DELETE FROM admin_auth_events WHERE occurred_at<$1",[eventCutoff]),sessions=await this.pool.query("DELETE FROM admin_sessions WHERE (status='REVOKED' AND revoked_at<$1) OR (status='ACTIVE' AND expires_at<$1)",[sessionCutoff]);return{deletedEvents:events.rowCount??0,deletedSessions:sessions.rowCount??0};}

  clearCookie(): string {
    return `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${this.#secure ? "; Secure" : ""}`;
  }
}
