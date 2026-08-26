import { randomUUID } from "node:crypto";
import type pg from "pg";
import { assertSchema } from "../ai/schema-registry.js";
import { DomainError } from "../brand/errors.js";

export type ContentRevision = Readonly<{id:string;productContentId:string;revision:number;contentData:Record<string,unknown>;source:"AI"|"EDITOR";status:"DRAFT"|"APPROVED"|"SUPERSEDED";createdBy:string;approvedBy:string|null;createdAt:Date;approvedAt:Date|null}>;
type Row={id:string;product_content_id:string;revision:number;content_data:Record<string,unknown>;source:ContentRevision["source"];status:ContentRevision["status"];created_by:string;approved_by:string|null;created_at:Date;approved_at:Date|null};
const fields="r.id,r.product_content_id,r.revision,r.content_data,r.source,r.status,r.created_by,r.approved_by,r.created_at,r.approved_at";
const map=(r:Row):ContentRevision=>({id:r.id,productContentId:r.product_content_id,revision:r.revision,contentData:r.content_data,source:r.source,status:r.status,createdBy:r.created_by,approvedBy:r.approved_by,createdAt:r.created_at,approvedAt:r.approved_at});

export class ProductContentReviewService{
  constructor(private readonly pool:pg.Pool){}
  async list(workspaceId:string):Promise<readonly ContentRevision[]>{const q=await this.pool.query<Row>(`SELECT DISTINCT ON (r.product_content_id) ${fields} FROM product_content_revisions r JOIN product_contents pc ON pc.id=r.product_content_id JOIN product_candidates c ON c.id=pc.candidate_id JOIN product_candidate_jobs j ON j.id=c.job_id WHERE j.workspace_id=$1 ORDER BY r.product_content_id,r.revision DESC`,[workspaceId]);return q.rows.map(map);}
  async createRevision(input:Readonly<{workspaceId:string;productContentId:string;contentData:Record<string,unknown>;actorId:string}>):Promise<ContentRevision|null>{
    assertSchema("productContent",input.contentData);const client=await this.pool.connect();try{await client.query("BEGIN");
      const base=await client.query<{recommended_retail_minor:string;currency:string}>(`SELECT c.recommended_retail_minor,c.currency FROM product_contents pc JOIN product_candidates c ON c.id=pc.candidate_id JOIN product_candidate_jobs j ON j.id=c.job_id WHERE pc.id=$1 AND j.workspace_id=$2 FOR UPDATE OF pc`,[input.productContentId,input.workspaceId]);
      const row=base.rows[0];if(!row){await client.query("ROLLBACK");return null;}const pricing=input.contentData.pricing_hint as Record<string,unknown>;
      if(pricing.currency!==row.currency||pricing.suggested_retail_minor!==Number(row.recommended_retail_minor))throw new DomainError("AUTHORITATIVE_PRICE_MISMATCH","Content price must match the approved candidate price");
      const inserted=await client.query<Row>(`INSERT INTO product_content_revisions(id,product_content_id,revision,content_data,source,status,created_by) SELECT $1,$2,COALESCE(max(revision),0)+1,$3::jsonb,'EDITOR','DRAFT',$4 FROM product_content_revisions WHERE product_content_id=$2 RETURNING id,product_content_id,revision,content_data,source,status,created_by,approved_by,created_at,approved_at`,[randomUUID(),input.productContentId,JSON.stringify(input.contentData),input.actorId]);await client.query("COMMIT");return map(inserted.rows[0]!);
    }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}}
  async approve(input:Readonly<{workspaceId:string;revisionId:string;actorId:string;idempotencyKey:string}>):Promise<ContentRevision|null>{const client=await this.pool.connect();try{await client.query("BEGIN");
    const selected=await client.query<Row>(`SELECT ${fields} FROM product_content_revisions r JOIN product_contents pc ON pc.id=r.product_content_id JOIN product_candidates c ON c.id=pc.candidate_id JOIN product_candidate_jobs j ON j.id=c.job_id WHERE r.id=$1 AND j.workspace_id=$2 FOR UPDATE OF r`,[input.revisionId,input.workspaceId]);const row=selected.rows[0];if(!row){await client.query("ROLLBACK");return null;}
    if(row.status==='SUPERSEDED')throw new DomainError("CONTENT_REVISION_SUPERSEDED","Superseded content cannot be approved");
    if(row.status!=='APPROVED'){await client.query("UPDATE product_content_revisions SET status='SUPERSEDED' WHERE product_content_id=$1 AND status='APPROVED'",[row.product_content_id]);await client.query("UPDATE product_content_revisions SET status='APPROVED',approved_by=$2,approved_at=now() WHERE id=$1",[row.id,input.actorId]);await client.query(`INSERT INTO shopify_publication_jobs(id,content_revision_id,workspace_id,correlation_id,status) VALUES($1,$2,$3,$4,'WAITING_FOR_MOCKUP') ON CONFLICT(content_revision_id) DO NOTHING`,[randomUUID(),row.id,input.workspaceId,input.idempotencyKey]);await client.query(`INSERT INTO printful_mockup_jobs(id,content_revision_id,design_asset_id,workspace_id) SELECT $1,$2,da.id,$3 FROM product_contents pc JOIN product_candidates c ON c.id=pc.candidate_id JOIN design_assets da ON da.candidate_id=c.id WHERE pc.id=$4 ON CONFLICT(content_revision_id) DO NOTHING`,[randomUUID(),row.id,input.workspaceId,row.product_content_id]);}
    const result=await client.query<Row>(`SELECT ${fields} FROM product_content_revisions r WHERE r.id=$1`,[row.id]);await client.query("COMMIT");return map(result.rows[0]!);
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}}
}
