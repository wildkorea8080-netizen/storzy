import { randomBytes, randomUUID } from "node:crypto";
import type pg from "pg";
import type { CredentialCipher, EncryptedCredentials } from "./credential-cipher.js";
import { DomainError } from "../brand/errors.js";

export type StoredProvider = "SHOPIFY" | "PRINTFUL";
export type StoredConnection = Readonly<{id:string;workspaceId:string;provider:StoredProvider;status:"CONNECTED"|"DISCONNECTED"|"REAUTH_REQUIRED";accountLabel:string;metadata:Record<string,unknown>;updatedAt:Date}>;
export type DisconnectReadiness = Readonly<{provider:StoredProvider;safe:boolean;blockingCount:number;blockers:Readonly<Record<string,number>>}>;

export class IntegrationConnectionRepository {
  constructor(readonly pool:pg.Pool,readonly cipher:CredentialCipher){}

  async upsert(input:{workspaceId:string;provider:StoredProvider;accountLabel:string;credentials:Record<string,string>;metadata?:Record<string,unknown>;actorId:string}):Promise<StoredConnection>{
    const client=await this.pool.connect(),context=`storzy:${input.workspaceId}:${input.provider}`,encrypted=this.cipher.encrypt(input.credentials,context);
    try{
      await client.query("BEGIN");
      if(input.provider==="SHOPIFY"){
        const shopDomain=input.accountLabel.trim().toLowerCase();
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`storzy:shopify-owner:${shopDomain}`]);
        const owner=await client.query<{workspace_id:string}>("SELECT workspace_id FROM integration_connections WHERE provider='SHOPIFY' AND lower(account_label)=$1 AND status='CONNECTED' AND workspace_id<>$2 LIMIT 1",[shopDomain,input.workspaceId]);
        if(owner.rows[0])throw new DomainError("SHOPIFY_ACCOUNT_ALREADY_CONNECTED","이 Shopify 스토어는 이미 다른 워크스페이스에 연결되어 있습니다.");
      }
      const existing=await client.query<{id:string;status:string}>("SELECT id,status FROM integration_connections WHERE workspace_id=$1 AND provider=$2 FOR UPDATE",[input.workspaceId,input.provider]);
      const previous=existing.rows[0],id=previous?.id??randomUUID(),action=previous?"CREDENTIALS_ROTATED":"CONNECTED";
      const saved=await client.query<{id:string;workspace_id:string;provider:StoredProvider;status:StoredConnection["status"];account_label:string;metadata:Record<string,unknown>;updated_at:Date}>(`
        INSERT INTO integration_connections(id,workspace_id,provider,status,account_label,encrypted_payload,encryption_iv,encryption_auth_tag,encryption_key_version,metadata,created_by,updated_by)
        VALUES($1,$2,$3,'CONNECTED',$4,$5,$6,$7,$8,$9,$10,$10)
        ON CONFLICT(workspace_id,provider) DO UPDATE SET status='CONNECTED',account_label=EXCLUDED.account_label,encrypted_payload=EXCLUDED.encrypted_payload,encryption_iv=EXCLUDED.encryption_iv,encryption_auth_tag=EXCLUDED.encryption_auth_tag,encryption_key_version=EXCLUDED.encryption_key_version,metadata=EXCLUDED.metadata,updated_by=EXCLUDED.updated_by,updated_at=now()
        RETURNING id,workspace_id,provider,status,account_label,metadata,updated_at`,[id,input.workspaceId,input.provider,input.accountLabel,encrypted.ciphertext,encrypted.iv,encrypted.authTag,encrypted.keyVersion,input.metadata??{},input.actorId]);
      await client.query("INSERT INTO integration_connection_actions(id,connection_id,workspace_id,provider,action,actor_id,before_status,after_status) VALUES($1,$2,$3,$4,$5,$6,$7,'CONNECTED')",[randomUUID(),saved.rows[0]!.id,input.workspaceId,input.provider,action,input.actorId,previous?.status??null]);
      if(input.provider==="SHOPIFY"){
        const shopDomain=input.accountLabel.trim().toLowerCase();
        await client.query(`WITH updated AS(UPDATE shopify_privacy_requests SET workspace_id=$1 WHERE workspace_id IS NULL AND lower(shop_domain)=$2 RETURNING id,status) INSERT INTO shopify_privacy_request_actions(id,request_id,action,actor_id,reason,before_status,after_status) SELECT gen_random_uuid(),id,'RECONCILE_WORKSPACE',$3,'Automatically matched during Shopify connection',status,status FROM updated`,[input.workspaceId,shopDomain,input.actorId]);
        await client.query("UPDATE shopify_privacy_webhook_receipts SET workspace_id=$1 WHERE workspace_id IS NULL AND lower(shop_domain)=$2",[input.workspaceId,shopDomain]);
      }
      await client.query("COMMIT");
      const row=saved.rows[0]!;
      return {id:row.id,workspaceId:row.workspace_id,provider:row.provider,status:row.status,accountLabel:row.account_label,metadata:row.metadata,updatedAt:row.updated_at};
    }catch(error){await client.query("ROLLBACK");throw error;}finally{encrypted.ciphertext.fill(0);client.release();}
  }

  async credentials(workspaceId:string,provider:StoredProvider):Promise<Record<string,string>|null>{
    const found=await this.pool.query<{encrypted_payload:Buffer;encryption_iv:Buffer;encryption_auth_tag:Buffer;encryption_key_version:string}>("SELECT encrypted_payload,encryption_iv,encryption_auth_tag,encryption_key_version FROM integration_connections WHERE workspace_id=$1 AND provider=$2 AND status='CONNECTED'",[workspaceId,provider]);
    const row=found.rows[0];if(!row)return null;
    const encrypted:EncryptedCredentials={ciphertext:row.encrypted_payload,iv:row.encryption_iv,authTag:row.encryption_auth_tag,keyVersion:row.encryption_key_version};
    return this.cipher.decrypt(encrypted,`storzy:${workspaceId}:${provider}`);
  }

  async withCredentialRotationLock<T>(workspaceId:string,provider:StoredProvider,task:()=>Promise<T>):Promise<T>{
    const client=await this.pool.connect(),lockKey=`storzy:credential-rotation:${workspaceId}:${provider}`;let locked=false;
    try{await client.query("SELECT pg_advisory_lock(hashtext($1))",[lockKey]);locked=true;return await task();}
    finally{if(locked)await client.query("SELECT pg_advisory_unlock(hashtext($1))",[lockKey]);client.release();}
  }

  async list(workspaceId:string):Promise<StoredConnection[]>{
    const found=await this.pool.query<{id:string;workspace_id:string;provider:StoredProvider;status:StoredConnection["status"];account_label:string;metadata:Record<string,unknown>;updated_at:Date}>("SELECT id,workspace_id,provider,status,account_label,metadata,updated_at FROM integration_connections WHERE workspace_id=$1 ORDER BY provider",[workspaceId]);
    return found.rows.map(row=>({id:row.id,workspaceId:row.workspace_id,provider:row.provider,status:row.status,accountLabel:row.account_label,metadata:row.metadata,updatedAt:row.updated_at}));
  }

  async connectedWorkspaceForAccount(provider:StoredProvider,accountLabel:string):Promise<string|null>{
    const found=await this.pool.query<{workspace_id:string}>("SELECT workspace_id FROM integration_connections WHERE provider=$1 AND lower(account_label)=lower($2) AND status='CONNECTED' LIMIT 1",[provider,accountLabel.trim()]);
    return found.rows[0]?.workspace_id??null;
  }

  async privacyWorkspaceForShopifyAccount(shopDomain:string,afterUninstall=false):Promise<string|null>{
    if(afterUninstall){const recent=await this.pool.query<{workspace_id:string}>("SELECT workspace_id FROM shopify_app_uninstall_receipts WHERE lower(shop_domain)=lower($1) AND workspace_id IS NOT NULL AND received_at>=now()-interval '7 days' ORDER BY received_at DESC LIMIT 1",[shopDomain.trim()]);if(recent.rows[0])return recent.rows[0].workspace_id;}
    return this.connectedWorkspaceForAccount("SHOPIFY",shopDomain);
  }

  async connectedWorkspaceForPrintfulStore(storeId:string):Promise<string|null>{
    const found=await this.pool.query<{workspace_id:string}>("SELECT workspace_id FROM integration_connections WHERE provider='PRINTFUL' AND metadata->>'storeId'=$1 AND status='CONNECTED' LIMIT 1",[storeId.trim()]);
    return found.rows[0]?.workspace_id??null;
  }

  async revokeShopifyInstallation(input:{shopDomain:string;webhookId:string}){
    const shopDomain=input.shopDomain.trim().toLowerCase(),webhookId=input.webhookId.trim();
    const client=await this.pool.connect();
    try{
      await client.query("BEGIN");
      const receipt=await client.query<{id:string}>("INSERT INTO shopify_app_uninstall_receipts(id,webhook_id,shop_domain,workspace_matched) VALUES($1,$2,$3,false) ON CONFLICT(webhook_id) DO NOTHING RETURNING id",[randomUUID(),webhookId,shopDomain]);
      if(!receipt.rowCount){await client.query("COMMIT");return{accepted:true,duplicate:true,workspaceMatched:false};}
      const found=await client.query<{id:string;workspace_id:string;status:StoredConnection["status"]}>("SELECT id,workspace_id,status FROM integration_connections WHERE provider='SHOPIFY' AND lower(account_label)=$1 ORDER BY CASE status WHEN 'CONNECTED' THEN 0 WHEN 'REAUTH_REQUIRED' THEN 1 ELSE 2 END,updated_at DESC LIMIT 1 FOR UPDATE",[shopDomain]),connection=found.rows[0];
      if(connection){
        if(connection.status!=="DISCONNECTED"){
          await client.query("UPDATE integration_connections SET status='DISCONNECTED',encrypted_payload=$2,encryption_iv=$3,encryption_auth_tag=$4,encryption_key_version='destroyed',metadata='{}'::jsonb,updated_by='shopify-app-uninstalled',updated_at=now() WHERE id=$1",[connection.id,randomBytes(32),randomBytes(12),randomBytes(16)]);
          await client.query("INSERT INTO integration_connection_actions(id,connection_id,workspace_id,provider,action,actor_id,before_status,after_status,reason) VALUES($1,$2,$3,'SHOPIFY','DISCONNECTED','shopify-app-uninstalled',$4,'DISCONNECTED','Shopify app uninstalled')",[randomUUID(),connection.id,connection.workspace_id,connection.status]);
        }
        await client.query("UPDATE shopify_app_uninstall_receipts SET connection_id=$2,workspace_id=$3,workspace_matched=true WHERE id=$1",[receipt.rows[0]!.id,connection.id,connection.workspace_id]);
      }
      await client.query("COMMIT");
      return{accepted:true,duplicate:false,workspaceMatched:Boolean(connection),workspaceId:connection?.workspace_id??null,alreadyDisconnected:connection?.status==="DISCONNECTED"};
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }

  async markReauthRequired(input:{workspaceId:string;provider:StoredProvider;actorId:string;reason:string}):Promise<StoredConnection|null>{
    const actorId=input.actorId.trim(),reason=input.reason.trim();if(!actorId||actorId.length>128)throw new Error("actorId is required");if(reason.length<1||reason.length>500)throw new Error("Reauthentication reason must be between 1 and 500 characters");
    const client=await this.pool.connect();
    try{
      await client.query("BEGIN");
      const found=await client.query<{id:string;status:StoredConnection["status"]}>("SELECT id,status FROM integration_connections WHERE workspace_id=$1 AND provider=$2 FOR UPDATE",[input.workspaceId,input.provider]),current=found.rows[0];
      if(!current){await client.query("ROLLBACK");return null;}
      const saved=await client.query<{id:string;workspace_id:string;provider:StoredProvider;status:StoredConnection["status"];account_label:string;metadata:Record<string,unknown>;updated_at:Date}>("UPDATE integration_connections SET status='REAUTH_REQUIRED',metadata=metadata||jsonb_build_object('reauthReason',$3,'reauthRequiredAt',now()),updated_by=$4,updated_at=now() WHERE id=$1 AND workspace_id=$2 RETURNING id,workspace_id,provider,status,account_label,metadata,updated_at",[current.id,input.workspaceId,reason,actorId]);
      await client.query("INSERT INTO integration_connection_actions(id,connection_id,workspace_id,provider,action,actor_id,before_status,after_status,reason) VALUES($1,$2,$3,$4,'REAUTH_REQUIRED',$5,$6,'REAUTH_REQUIRED',$7)",[randomUUID(),current.id,input.workspaceId,input.provider,actorId,current.status,reason]);
      await client.query("COMMIT");const row=saved.rows[0]!;return{id:row.id,workspaceId:row.workspace_id,provider:row.provider,status:row.status,accountLabel:row.account_label,metadata:row.metadata,updatedAt:row.updated_at};
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }

  async recordCredentialRefreshFailure(input:{workspaceId:string;provider:StoredProvider;error:string}):Promise<void>{
    const error=input.error.replace(/[\r\n\t]+/g," ").trim().slice(0,500)||"UNKNOWN_REFRESH_ERROR";
    await this.pool.query(`UPDATE integration_connections SET metadata=jsonb_set(jsonb_set(jsonb_set(metadata,'{refreshFailureCount}',to_jsonb(COALESCE((metadata->>'refreshFailureCount')::int,0)+1)),'{lastRefreshFailureAt}',to_jsonb(now())),'{lastRefreshError}',to_jsonb($3::text)),updated_at=now() WHERE workspace_id=$1 AND provider=$2 AND status='CONNECTED'`,[input.workspaceId,input.provider,error]);
  }

  async disconnectReadiness(workspaceId:string,provider:StoredProvider):Promise<DisconnectReadiness>{
    if(provider==="PRINTFUL"){
      const found=await this.pool.query<{order_jobs:string;mockup_jobs:string}>(`SELECT
        (SELECT count(*) FROM printful_order_jobs WHERE workspace_id=$1 AND status IN ('PENDING_DRAFT','RUNNING','WAITING_COST','READY_CONFIRM'))::text order_jobs,
        (SELECT count(*) FROM printful_mockup_jobs WHERE workspace_id=$1 AND status IN ('PENDING','RUNNING','WAITING_REMOTE'))::text mockup_jobs`,[workspaceId]);
      const blockers={orderJobs:Number(found.rows[0]?.order_jobs??0),mockupJobs:Number(found.rows[0]?.mockup_jobs??0)},blockingCount=blockers.orderJobs+blockers.mockupJobs;
      return{provider,safe:blockingCount===0,blockingCount,blockers};
    }
    const found=await this.pool.query<{fulfillment_jobs:string;publication_jobs:string}>(`SELECT
      (SELECT count(*) FROM shopify_fulfillment_jobs j JOIN fulfillment_shipments s ON s.id=j.shipment_id JOIN commerce_orders o ON o.id=s.commerce_order_id WHERE o.workspace_id=$1 AND j.status IN ('PENDING','RUNNING'))::text fulfillment_jobs,
      (SELECT count(*) FROM shopify_store_publication_jobs j JOIN store_drafts d ON d.id=j.store_draft_id WHERE d.workspace_id=$1 AND j.status IN ('PENDING','RUNNING'))::text publication_jobs`,[workspaceId]);
    const blockers={fulfillmentJobs:Number(found.rows[0]?.fulfillment_jobs??0),publicationJobs:Number(found.rows[0]?.publication_jobs??0)},blockingCount=blockers.fulfillmentJobs+blockers.publicationJobs;
    return{provider,safe:blockingCount===0,blockingCount,blockers};
  }

  async disconnect(input:{workspaceId:string;provider:StoredProvider;actorId:string;reason:string}):Promise<StoredConnection|null>{
    const actorId=input.actorId.trim(),reason=input.reason.trim();if(!actorId||actorId.length>128)throw new Error("actorId is required");if(reason.length<1||reason.length>500)throw new Error("Disconnect reason must be between 1 and 500 characters");
    const client=await this.pool.connect();
    try{await client.query("BEGIN");const found=await client.query<{id:string;status:StoredConnection["status"]}>("SELECT id,status FROM integration_connections WHERE workspace_id=$1 AND provider=$2 FOR UPDATE",[input.workspaceId,input.provider]),current=found.rows[0];if(!current){await client.query("ROLLBACK");return null;}const saved=await client.query<{id:string;workspace_id:string;provider:StoredProvider;status:StoredConnection["status"];account_label:string;metadata:Record<string,unknown>;updated_at:Date}>("UPDATE integration_connections SET status='DISCONNECTED',encrypted_payload=$3,encryption_iv=$4,encryption_auth_tag=$5,encryption_key_version='destroyed',metadata='{}'::jsonb,updated_by=$6,updated_at=now() WHERE id=$1 AND workspace_id=$2 RETURNING id,workspace_id,provider,status,account_label,metadata,updated_at",[current.id,input.workspaceId,randomBytes(32),randomBytes(12),randomBytes(16),actorId]);await client.query("INSERT INTO integration_connection_actions(id,connection_id,workspace_id,provider,action,actor_id,before_status,after_status,reason) VALUES($1,$2,$3,$4,'DISCONNECTED',$5,$6,'DISCONNECTED',$7)",[randomUUID(),current.id,input.workspaceId,input.provider,actorId,current.status,reason]);await client.query("COMMIT");const row=saved.rows[0]!;return{id:row.id,workspaceId:row.workspace_id,provider:row.provider,status:row.status,accountLabel:row.account_label,metadata:row.metadata,updatedAt:row.updated_at};}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }
}
