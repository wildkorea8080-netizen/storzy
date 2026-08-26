import { randomUUID } from "node:crypto";
import type pg from "pg";
import { assertSchema } from "../ai/schema-registry.js";
import { ConflictError, NotFoundError } from "../brand/errors.js";
import { buildStoreConfig, type StoreConfig, type StoreTemplateKey } from "./config-builder.js";
import { mapStoreConfigToShopifyPlan } from "./shopify-plan.js";

export type StoreDraft = Readonly<{
  id:string; workspaceId:string; brandProfileRevisionId:string; revision:number;
  status:"DRAFT"|"APPROVED"|"PUBLISHED"|"SUPERSEDED"; templateKey:StoreTemplateKey;
  configData:StoreConfig; source:"GENERATED"|"EDITOR"; baseStoreDraftId:string|null;
  createdBy:string; approvedBy:string|null; createdAt:Date; approvedAt:Date|null;
  publicationStatus:"PENDING"|"RUNNING"|"SUCCEEDED"|"FAILED"|null; publicationAttempts:number; publicationError:string|null;
}>;
export type StorefrontProduct=Readonly<{id:string;title:string;adminTitle:string;description:string;collection:string;tags:readonly string[];priceMinor:number;currency:string;imageUrl:string|null;shopifyProductId:string}>;

type Row={id:string;workspace_id:string;brand_profile_revision_id:string;revision:number;status:StoreDraft["status"];template_key:StoreTemplateKey;config_data:StoreConfig;source:StoreDraft["source"];base_store_draft_id:string|null;created_by:string;approved_by:string|null;created_at:Date;approved_at:Date|null;publication_status?:StoreDraft["publicationStatus"];publication_attempts?:number;publication_error?:string|null};
const map=(r:Row):StoreDraft=>({id:r.id,workspaceId:r.workspace_id,brandProfileRevisionId:r.brand_profile_revision_id,revision:r.revision,status:r.status,templateKey:r.template_key,configData:r.config_data,source:r.source,baseStoreDraftId:r.base_store_draft_id,createdBy:r.created_by,approvedBy:r.approved_by,createdAt:r.created_at,approvedAt:r.approved_at,publicationStatus:r.publication_status??null,publicationAttempts:Number(r.publication_attempts??0),publicationError:r.publication_error??null});
const actor=(value:string)=>{const result=value.trim();if(!result)throw new ConflictError("INVALID_INPUT","actorId is required");return result};

export class StoreConfigService {
  constructor(private readonly pool:pg.Pool){}

  async generate(input:Readonly<{workspaceId:string;actorId:string}>):Promise<StoreDraft>{
    const actorId=actor(input.actorId),client=await this.pool.connect();
    try{
      await client.query("BEGIN");
      const approved=await client.query<{id:string;profile_data:Record<string,unknown>}>(`SELECT r.id,r.profile_data FROM brand_profile_revisions r JOIN brand_profiles p ON p.id=r.brand_profile_id WHERE p.workspace_id=$1 AND r.status='APPROVED' FOR UPDATE OF r`,[input.workspaceId]);
      const source=approved.rows[0];
      if(!source)throw new ConflictError("APPROVED_BRAND_PROFILE_REQUIRED","Approve a Brand Profile before generating the store");
      const existing=await client.query<Row>("SELECT * FROM store_drafts WHERE brand_profile_revision_id=$1 AND source='GENERATED'",[source.id]);
      if(existing.rows[0]){await client.query("COMMIT");return map(existing.rows[0]);}
      const revision=await this.nextRevision(client,input.workspaceId),id=randomUUID(),config=buildStoreConfig(source.profile_data);
      assertSchema("storeConfig",config);
      const inserted=await client.query<Row>(`INSERT INTO store_drafts(id,workspace_id,brand_profile_revision_id,revision,template_key,config_data,created_by) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7) RETURNING *`,[id,input.workspaceId,source.id,revision,config.templateKey,JSON.stringify(config),actorId]);
      await this.audit(client,input.workspaceId,actorId,"store-draft.generated",id,{revision,templateKey:config.templateKey,brandProfileRevisionId:source.id});
      await client.query("COMMIT");
      if(!inserted.rows[0])throw new Error("Store draft insert returned no row");
      return map(inserted.rows[0]);
    }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
  }

  async list(workspaceId:string):Promise<readonly StoreDraft[]>{
    const workspace=await this.pool.query("SELECT 1 FROM workspaces WHERE id=$1",[workspaceId]);
    if(!workspace.rowCount)throw new NotFoundError("Workspace");
    const result=await this.pool.query<Row>(`SELECT d.*,j.status publication_status,j.attempts publication_attempts,j.last_error publication_error FROM store_drafts d LEFT JOIN shopify_store_publication_jobs j ON j.store_draft_id=d.id WHERE d.workspace_id=$1 ORDER BY d.revision DESC LIMIT 50`,[workspaceId]);
    return result.rows.map(map);
  }

  async published(workspaceId:string):Promise<StoreDraft|null>{
    const result=await this.pool.query<Row>(`SELECT d.*,j.status publication_status,j.attempts publication_attempts,j.last_error publication_error FROM store_drafts d LEFT JOIN shopify_store_publication_jobs j ON j.store_draft_id=d.id WHERE d.workspace_id=$1 AND d.status='PUBLISHED' ORDER BY d.revision DESC LIMIT 1`,[workspaceId]);
    return result.rows[0]?map(result.rows[0]):null;
  }

  async publishedProducts(workspaceId:string):Promise<readonly StorefrontProduct[]>{
    const result=await this.pool.query<{id:string;content_data:Record<string,unknown>;recommended_retail_minor:string;currency:string;mockup_data:Record<string,unknown>|null;shopify_product_id:string}>(`SELECT r.id,r.content_data,c.recommended_retail_minor,c.currency,ms.data mockup_data,j.shopify_product_id FROM shopify_publication_jobs j JOIN product_content_revisions r ON r.id=j.content_revision_id JOIN product_contents pc ON pc.id=r.product_content_id JOIN product_candidates c ON c.id=pc.candidate_id LEFT JOIN mockup_snapshots ms ON ms.id=j.mockup_snapshot_id WHERE j.workspace_id=$1 AND j.status='SUCCEEDED' AND r.status='APPROVED' ORDER BY j.finished_at DESC,r.id`,[workspaceId]);
    return result.rows.map(row=>{const c=row.content_data,images=Array.isArray(row.mockup_data?.images)?row.mockup_data.images as Record<string,unknown>[]:[],first=images.find(image=>typeof image.url==='string');return{id:row.id,title:String(c.title_en??'Product'),adminTitle:String(c.admin_title_ko??c.title_en??'상품'),description:String(c.description??''),collection:String(c.collection??'Collection'),tags:Array.isArray(c.tags)?c.tags.filter((tag):tag is string=>typeof tag==='string'):[],priceMinor:Number(row.recommended_retail_minor),currency:row.currency,imageUrl:first?String(first.url):null,shopifyProductId:row.shopify_product_id}});
  }

  async createRevision(input:Readonly<{workspaceId:string;baseDraftId:string;configData:unknown;actorId:string}>):Promise<StoreDraft>{
    if(!input.configData||typeof input.configData!=="object"||Array.isArray(input.configData))throw new ConflictError("INVALID_INPUT","configData must be an object");
    assertSchema("storeConfig",input.configData);
    const config=input.configData as StoreConfig,actorId=actor(input.actorId),client=await this.pool.connect();
    try{
      await client.query("BEGIN");
      const current=await client.query<Row>("SELECT * FROM store_drafts WHERE id=$1 AND workspace_id=$2 FOR UPDATE",[input.baseDraftId,input.workspaceId]);
      const base=current.rows[0];if(!base)throw new NotFoundError("Store draft");
      if(base.status==="PUBLISHED")throw new ConflictError("INVALID_DRAFT_STATE","Published configuration cannot be edited directly");
      await client.query("SELECT id FROM workspaces WHERE id=$1 FOR UPDATE",[input.workspaceId]);
      const revision=await this.nextRevision(client,input.workspaceId),id=randomUUID();
      const inserted=await client.query<Row>(`INSERT INTO store_drafts(id,workspace_id,brand_profile_revision_id,revision,status,template_key,config_data,source,base_store_draft_id,created_by) VALUES($1,$2,$3,$4,'DRAFT',$5,$6::jsonb,'EDITOR',$7,$8) RETURNING *`,[id,input.workspaceId,base.brand_profile_revision_id,revision,config.templateKey,JSON.stringify(config),base.id,actorId]);
      await this.audit(client,input.workspaceId,actorId,"store-draft.editor-revision-created",id,{revision,baseStoreDraftId:base.id,templateKey:config.templateKey});
      await client.query("COMMIT");
      if(!inserted.rows[0])throw new Error("Store draft revision insert returned no row");return map(inserted.rows[0]);
    }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
  }

  async approve(input:Readonly<{workspaceId:string;draftId:string;actorId:string}>):Promise<StoreDraft>{
    const actorId=actor(input.actorId),client=await this.pool.connect();
    try{
      await client.query("BEGIN");await client.query("SELECT id FROM workspaces WHERE id=$1 FOR UPDATE",[input.workspaceId]);
      const current=await client.query<Row>("SELECT * FROM store_drafts WHERE id=$1 AND workspace_id=$2 FOR UPDATE",[input.draftId,input.workspaceId]);
      const draft=current.rows[0];if(!draft)throw new NotFoundError("Store draft");
      if(draft.status!=="DRAFT")throw new ConflictError("INVALID_DRAFT_STATE","Only a draft configuration can be approved");
      await client.query("UPDATE store_drafts SET status='SUPERSEDED' WHERE workspace_id=$1 AND status='APPROVED'",[input.workspaceId]);
      const result=await client.query<Row>("UPDATE store_drafts SET status='APPROVED',approved_by=$3,approved_at=now() WHERE id=$1 AND workspace_id=$2 RETURNING *",[input.draftId,input.workspaceId,actorId]);
      const plan=mapStoreConfigToShopifyPlan(draft.config_data);
      await client.query(`INSERT INTO shopify_store_publication_jobs(id,store_draft_id,request_payload) VALUES($1,$2,$3::jsonb) ON CONFLICT(store_draft_id) DO NOTHING`,[randomUUID(),input.draftId,JSON.stringify(plan)]);
      await this.audit(client,input.workspaceId,actorId,"store-draft.approved",input.draftId,{revision:draft.revision,status:"APPROVED"});
      await client.query("COMMIT");if(!result.rows[0])throw new Error("Approved store draft was not found");return map(result.rows[0]);
    }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
  }

  async requeuePublication(input:Readonly<{workspaceId:string;draftId:string;actorId:string;reason:string}>):Promise<Readonly<{status:"PENDING"}>>{
    const actorId=actor(input.actorId),reason=input.reason.trim();if(!reason||reason.length>500)throw new ConflictError("INVALID_INPUT","reason must be between 1 and 500 characters");
    const client=await this.pool.connect();try{await client.query("BEGIN");
      const job=await client.query<{id:string;status:string}>(`SELECT j.id,j.status FROM shopify_store_publication_jobs j JOIN store_drafts d ON d.id=j.store_draft_id WHERE d.id=$1 AND d.workspace_id=$2 FOR UPDATE OF j`,[input.draftId,input.workspaceId]);
      const current=job.rows[0];if(!current)throw new NotFoundError("Store publication job");if(current.status!=="FAILED")throw new ConflictError("PUBLICATION_NOT_FAILED","Only a failed publication can be requeued");
      await client.query("UPDATE shopify_store_publication_jobs SET status='PENDING',attempts=0,last_error=NULL,available_at=now(),finished_at=NULL WHERE id=$1",[current.id]);
      await client.query("INSERT INTO audit_events(id,workspace_id,actor_id,action,target_type,target_id,before_data,after_data) VALUES($1,$2,$3,'store-publication.requeued','store_publication_job',$4,$5::jsonb,$6::jsonb)",[randomUUID(),input.workspaceId,actorId,current.id,JSON.stringify({status:"FAILED",reason}),JSON.stringify({status:"PENDING",attempts:0})]);
      await client.query("COMMIT");return{status:"PENDING"};
    }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
  }

  private async nextRevision(client:pg.PoolClient,workspaceId:string){const q=await client.query<{revision:number}>("SELECT COALESCE(MAX(revision),0)+1 revision FROM store_drafts WHERE workspace_id=$1",[workspaceId]);return Number(q.rows[0]?.revision??1)}
  private async audit(client:pg.PoolClient,workspaceId:string,actorId:string,action:string,targetId:string,after:unknown){await client.query("INSERT INTO audit_events(id,workspace_id,actor_id,action,target_type,target_id,after_data) VALUES($1,$2,$3,$4,'store_draft',$5,$6::jsonb)",[randomUUID(),workspaceId,actorId,action,targetId,JSON.stringify(after)])}
}
