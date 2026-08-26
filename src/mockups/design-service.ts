import { randomUUID } from "node:crypto";
import type pg from "pg";
import { DomainError } from "../brand/errors.js";
import type { PlacementGuideline } from "../candidates/types.js";
import type { DesignFileInspector } from "./file-inspector.js";
import { evaluateDesignResolution, validateMockupStyleSelection } from "./resolution-gate.js";

export type DesignAssetInput=Readonly<{workspaceId:string;candidateId:string;fileUrl:string;placement:string;technique:string;mockupStyleIds:readonly number[];actorId:string}>;
export type ResolutionOverrideInput=Readonly<{workspaceId:string;candidateId:string;printAreaWidthIn:number;printAreaHeightIn:number;targetDpi:number;allowedMockupStyleIds?:readonly number[];actorId:string;reason:string;idempotencyKey:string}>;
const text=(value:string,field:string)=>{const result=value.trim();if(!result)throw new DomainError("INVALID_INPUT",`${field} is required`);return result};
function guidelineFromSnapshot(snapshot:unknown,externalProductId:string,placement:string,technique:string):PlacementGuideline|undefined{
  if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot))return undefined;
  const products=(snapshot as {products?:unknown}).products;if(!Array.isArray(products))return undefined;
  const product=products.find(value=>value&&typeof value==="object"&&String((value as {externalProductId?:unknown}).externalProductId)===externalProductId) as {placementGuidelines?:unknown}|undefined;
  if(!Array.isArray(product?.placementGuidelines))return undefined;
  const value=product.placementGuidelines.find(item=>item&&typeof item==="object"&&String((item as {placement?:unknown}).placement)===placement&&String((item as {technique?:unknown}).technique).toLowerCase()===technique.toLowerCase());
  if(!value||typeof value!=="object")return undefined;const row=value as Record<string,unknown>,width=Number(row.printAreaWidthIn),height=Number(row.printAreaHeightIn),dpi=Number(row.targetDpi);
  const styleIds=Array.isArray(row.allowedMockupStyleIds)?[...new Set(row.allowedMockupStyleIds.map(Number).filter(value=>Number.isInteger(value)&&value>0))]:[];
  return Number.isFinite(width)&&width>0&&Number.isFinite(height)&&height>0&&Number.isFinite(dpi)&&dpi>=150?{placement,technique:technique.toLowerCase(),printAreaWidthIn:width,printAreaHeightIn:height,targetDpi:dpi,allowedMockupStyleIds:styleIds}:undefined;
}

export class DesignAssetService {
  constructor(private readonly pool:pg.Pool,private readonly inspector?:DesignFileInspector){}

  async register(input:DesignAssetInput){
    let url:URL;try{url=new URL(input.fileUrl)}catch{throw new DomainError("INVALID_INPUT","fileUrl must be a valid URL")}
    if(url.protocol!=="https:")throw new DomainError("INVALID_INPUT","fileUrl must use HTTPS");
    if(url.hostname==="preview-assets.storzy.local"&&url.pathname.startsWith("/uploads/")&&!url.pathname.startsWith(`/uploads/${encodeURIComponent(input.workspaceId)}/`))throw new DomainError("INVALID_DESIGN_FILE","Uploaded design belongs to another workspace");
    const metadata=this.inspector?await this.inspector.inspect(url.toString()):null;
    const placement=text(input.placement,"placement"),technique=text(input.technique,"technique"),actorId=text(input.actorId,"actorId");
    if(!/^[a-z0-9_-]{1,64}$/i.test(placement)||!/^[a-z0-9_-]{1,64}$/i.test(technique))throw new DomainError("INVALID_INPUT","placement and technique are invalid");
    if(!input.mockupStyleIds.length||input.mockupStyleIds.some(x=>!Number.isInteger(x)||x<=0))throw new DomainError("INVALID_INPUT","mockupStyleIds must contain positive integers");
    const client=await this.pool.connect();try{await client.query("BEGIN");
      const candidate=await client.query<{id:string;external_product_id:string;selected_technique:string|null;snapshot_data:unknown}>(`SELECT c.id,c.external_product_id,c.evidence->>'selectedTechnique' selected_technique,s.data snapshot_data FROM product_candidates c JOIN product_candidate_jobs j ON j.id=c.job_id JOIN catalog_snapshots s ON s.id=c.catalog_snapshot_id WHERE c.id=$1 AND j.workspace_id=$2 AND c.decision_status='APPROVED' FOR UPDATE OF c`,[input.candidateId,input.workspaceId]);
      if(!candidate.rows[0]){await client.query("ROLLBACK");return null}
      if(candidate.rows[0].selected_technique&&candidate.rows[0].selected_technique!==technique)throw new DomainError("DESIGN_TECHNIQUE_MISMATCH","Design technique must match the approved candidate");
      const guideline=guidelineFromSnapshot(candidate.rows[0].snapshot_data,candidate.rows[0].external_product_id,placement,technique);
      const styleValidation=guideline?validateMockupStyleSelection(input.mockupStyleIds,guideline.allowedMockupStyleIds):null;
      if(styleValidation==="GUIDANCE_MISSING")throw new DomainError("DESIGN_MOCKUP_STYLES_MISSING","No catalog-approved mockup styles are available for this placement and technique");
      if(styleValidation==="MISMATCH")throw new DomainError("DESIGN_MOCKUP_STYLE_MISMATCH","Every mockup style must belong to the selected product, placement and technique");
      const resolution=metadata?evaluateDesignResolution(metadata,guideline):null;
      if(resolution?.status==="FAILED")throw new DomainError("DESIGN_RESOLUTION_TOO_LOW",`Design requires at least ${resolution.requiredWidthPx}x${resolution.requiredHeightPx}px for ${resolution.guideline.targetDpi} DPI; received ${metadata!.widthPx}x${metadata!.heightPx}px`);
      const resolutionStatus=resolution?.status??"NOT_EVALUATED",effectiveDpi=resolution?.status==="PASSED"?resolution.effectiveDpi:null,printGuideline=resolution?.status==="PASSED"?resolution.guideline:null;
      const prior=await client.query<{id:string;file_url:string;placement:string;technique:string;mockup_style_ids:number[];job_id:string|null;job_status:string|null}>(`SELECT da.id,da.file_url,da.placement,da.technique,da.mockup_style_ids,j.id job_id,j.status job_status FROM design_assets da LEFT JOIN LATERAL(SELECT id,status FROM printful_mockup_jobs WHERE design_asset_id=da.id ORDER BY created_at DESC LIMIT 1)j ON true WHERE da.candidate_id=$1 FOR UPDATE OF da`,[input.candidateId]);
      const before=prior.rows[0];
      if(before?.job_status&&!["PENDING","FAILED"].includes(before.job_status))throw new DomainError("DESIGN_ASSET_LOCKED",`Design cannot change while mockup status is ${before.job_status}`);
      const asset=await client.query<{id:string}>(`INSERT INTO design_assets(id,candidate_id,workspace_id,file_url,placement,technique,mockup_style_ids,created_by,mime_type,size_bytes,width_px,height_px,validated_at,resolution_status,effective_dpi,print_guideline) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,CASE WHEN $9::text IS NULL THEN NULL ELSE now() END,$13,$14,$15::jsonb) ON CONFLICT(candidate_id) DO UPDATE SET file_url=EXCLUDED.file_url,placement=EXCLUDED.placement,technique=EXCLUDED.technique,mockup_style_ids=EXCLUDED.mockup_style_ids,created_by=EXCLUDED.created_by,mime_type=EXCLUDED.mime_type,size_bytes=EXCLUDED.size_bytes,width_px=EXCLUDED.width_px,height_px=EXCLUDED.height_px,validated_at=EXCLUDED.validated_at,resolution_status=EXCLUDED.resolution_status,effective_dpi=EXCLUDED.effective_dpi,print_guideline=EXCLUDED.print_guideline,updated_at=now() RETURNING id`,[randomUUID(),input.candidateId,input.workspaceId,metadata?.url??url.toString(),placement,technique,JSON.stringify(input.mockupStyleIds),actorId,metadata?.mimeType??null,metadata?.sizeBytes??null,metadata?.widthPx??null,metadata?.heightPx??null,resolutionStatus,effectiveDpi,printGuideline?JSON.stringify(printGuideline):null]);
      const canQueue=resolutionStatus!=="GUIDELINE_MISSING";
      if(!canQueue&&before?.job_status==="PENDING"&&before.job_id)await client.query("DELETE FROM printful_mockup_jobs WHERE id=$1",[before.job_id]);
      if(canQueue&&before?.job_status==="FAILED"&&before.job_id)await client.query("UPDATE printful_mockup_jobs SET status='PENDING',attempts=0,remote_task_ids=NULL,last_error=NULL,available_at=now(),finished_at=NULL WHERE id=$1",[before.job_id]);
      if(canQueue)await client.query(`INSERT INTO printful_mockup_jobs(id,content_revision_id,design_asset_id,workspace_id) SELECT $1,r.id,$2,$3 FROM product_contents pc JOIN product_content_revisions r ON r.product_content_id=pc.id AND r.status='APPROVED' WHERE pc.candidate_id=$4 ON CONFLICT(content_revision_id) DO NOTHING`,[randomUUID(),asset.rows[0]!.id,input.workspaceId,input.candidateId]);
      await client.query(`INSERT INTO audit_events(id,workspace_id,actor_id,action,target_type,target_id,before_data,after_data) VALUES($1,$2,$3,$4,'design_asset',$5,$6::jsonb,$7::jsonb)`,[randomUUID(),input.workspaceId,actorId,before?"design-asset.updated":"design-asset.registered",asset.rows[0]!.id,before?JSON.stringify({fileUrl:before.file_url,placement:before.placement,technique:before.technique,mockupStyleIds:before.mockup_style_ids}):null,JSON.stringify({fileUrl:url.toString(),placement,technique,mockupStyleIds:input.mockupStyleIds,resolutionStatus,effectiveDpi})]);
      await client.query("COMMIT");return{id:asset.rows[0]!.id,status:canQueue?(before?.job_status==="FAILED"?"REQUEUED" as const:"READY" as const):"REVIEW_REQUIRED" as const,resolutionStatus,effectiveDpi};
    }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
  }

  async requeue(input:Readonly<{workspaceId:string;candidateId:string;actorId:string;reason:string}>){
    const actorId=text(input.actorId,"actorId"),reason=text(input.reason,"reason");if(reason.length>500)throw new DomainError("INVALID_INPUT","reason must be at most 500 characters");
    const client=await this.pool.connect();try{await client.query("BEGIN");
      const result=await client.query<{id:string;status:string;resolution_status:string}>(`SELECT j.id,j.status,da.resolution_status FROM printful_mockup_jobs j JOIN design_assets da ON da.id=j.design_asset_id WHERE da.candidate_id=$1 AND da.workspace_id=$2 ORDER BY j.created_at DESC LIMIT 1 FOR UPDATE OF j`,[input.candidateId,input.workspaceId]);
      const job=result.rows[0];if(!job)throw new DomainError("NOT_FOUND","Mockup job was not found");if(job.status!=="FAILED")throw new DomainError("MOCKUP_NOT_FAILED","Only a failed mockup can be requeued");
      if(job.resolution_status==="GUIDELINE_MISSING")throw new DomainError("DESIGN_GUIDELINE_MISSING","Mockup cannot be requeued until print guidance is available");
      await client.query("UPDATE printful_mockup_jobs SET status='PENDING',attempts=0,remote_task_ids=NULL,last_error=NULL,available_at=now(),finished_at=NULL WHERE id=$1",[job.id]);
      await client.query(`INSERT INTO audit_events(id,workspace_id,actor_id,action,target_type,target_id,before_data,after_data) VALUES($1,$2,$3,'mockup.requeued','printful_mockup_job',$4,$5::jsonb,$6::jsonb)`,[randomUUID(),input.workspaceId,actorId,job.id,JSON.stringify({status:"FAILED",reason}),JSON.stringify({status:"PENDING",attempts:0})]);
      await client.query("COMMIT");return{status:"PENDING" as const};
    }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
  }

  async overrideResolution(input:ResolutionOverrideInput){
    const actorId=text(input.actorId,"actorId"),reason=text(input.reason,"reason");
    if(reason.length>500)throw new DomainError("INVALID_INPUT","reason must be at most 500 characters");
    if(!/^[A-Za-z0-9._:-]{1,128}$/.test(input.idempotencyKey))throw new DomainError("INVALID_INPUT","valid idempotencyKey is required");
    for(const [name,value] of [["printAreaWidthIn",input.printAreaWidthIn],["printAreaHeightIn",input.printAreaHeightIn],["targetDpi",input.targetDpi]] as const){if(!Number.isFinite(value)||value<=0)throw new DomainError("INVALID_INPUT",`${name} must be positive`)}
    if(input.printAreaWidthIn>100||input.printAreaHeightIn>100||!Number.isInteger(input.targetDpi)||input.targetDpi<150||input.targetDpi>1200)throw new DomainError("INVALID_INPUT","print area must be at most 100 inches and targetDpi must be an integer from 150 to 1200");
    if(input.allowedMockupStyleIds&&(!input.allowedMockupStyleIds.length||input.allowedMockupStyleIds.some(id=>!Number.isInteger(id)||id<=0)||new Set(input.allowedMockupStyleIds).size!==input.allowedMockupStyleIds.length))throw new DomainError("INVALID_INPUT","allowedMockupStyleIds must contain unique positive integers");
    const client=await this.pool.connect();try{await client.query("BEGIN");
      const duplicate=await client.query<{design_asset_id:string;candidate_id:string;effective_dpi:string}>("SELECT o.design_asset_id,da.candidate_id,o.effective_dpi FROM design_resolution_overrides o JOIN design_assets da ON da.id=o.design_asset_id WHERE o.workspace_id=$1 AND o.idempotency_key=$2",[input.workspaceId,input.idempotencyKey]);
      if(duplicate.rows[0]){if(duplicate.rows[0].candidate_id!==input.candidateId)throw new DomainError("IDEMPOTENCY_CONFLICT","Idempotency-Key was already used for another design");await client.query("COMMIT");return{id:duplicate.rows[0].design_asset_id,status:"READY" as const,resolutionStatus:"PASSED" as const,effectiveDpi:Number(duplicate.rows[0].effective_dpi),duplicate:true}}
      const selected=await client.query<{id:string;placement:string;technique:string;mockup_style_ids:number[];width_px:number|null;height_px:number|null;resolution_status:string}>(`SELECT da.id,da.placement,da.technique,da.mockup_style_ids,da.width_px,da.height_px,da.resolution_status FROM design_assets da JOIN product_candidates c ON c.id=da.candidate_id WHERE da.candidate_id=$1 AND da.workspace_id=$2 AND c.decision_status='APPROVED' FOR UPDATE OF da`,[input.candidateId,input.workspaceId]);
      const asset=selected.rows[0];if(!asset){await client.query("ROLLBACK");return null}if(asset.resolution_status!=="GUIDELINE_MISSING")throw new DomainError("DESIGN_OVERRIDE_NOT_ALLOWED","Only a design awaiting print guidance can be reviewed");if(!asset.width_px||!asset.height_px)throw new DomainError("DESIGN_DIMENSIONS_MISSING","Validated design dimensions are required");
      const verifiedStyleIds=input.allowedMockupStyleIds??asset.mockup_style_ids;
      if(asset.mockup_style_ids.some(id=>!verifiedStyleIds.includes(id)))throw new DomainError("DESIGN_MOCKUP_STYLE_MISMATCH","Saved mockup styles must be included in the operator-verified allowlist");
      const guideline:PlacementGuideline={placement:asset.placement,technique:asset.technique,printAreaWidthIn:input.printAreaWidthIn,printAreaHeightIn:input.printAreaHeightIn,targetDpi:input.targetDpi,allowedMockupStyleIds:[...verifiedStyleIds]},resolution=evaluateDesignResolution({widthPx:asset.width_px,heightPx:asset.height_px},guideline);
      if(resolution.status==="FAILED")throw new DomainError("DESIGN_RESOLUTION_TOO_LOW",`Design requires at least ${resolution.requiredWidthPx}x${resolution.requiredHeightPx}px for ${guideline.targetDpi} DPI; received ${asset.width_px}x${asset.height_px}px`);
      if(resolution.status!=="PASSED")throw new DomainError("DESIGN_GUIDELINE_MISSING","Print guidance could not be evaluated");
      await client.query("UPDATE design_assets SET resolution_status='PASSED',effective_dpi=$2,print_guideline=$3::jsonb,updated_at=now() WHERE id=$1",[asset.id,resolution.effectiveDpi,JSON.stringify(guideline)]);
      await client.query(`INSERT INTO printful_mockup_jobs(id,content_revision_id,design_asset_id,workspace_id) SELECT $1,r.id,$2,$3 FROM product_contents pc JOIN product_content_revisions r ON r.product_content_id=pc.id AND r.status='APPROVED' WHERE pc.candidate_id=$4 ON CONFLICT(content_revision_id) DO NOTHING`,[randomUUID(),asset.id,input.workspaceId,input.candidateId]);
      await client.query(`INSERT INTO design_resolution_overrides(id,design_asset_id,workspace_id,actor_id,reason,print_guideline,effective_dpi,idempotency_key) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,[randomUUID(),asset.id,input.workspaceId,actorId,reason,JSON.stringify(guideline),resolution.effectiveDpi,input.idempotencyKey]);
      await client.query(`INSERT INTO audit_events(id,workspace_id,actor_id,action,target_type,target_id,before_data,after_data) VALUES($1,$2,$3,'design-resolution.overridden','design_asset',$4,$5::jsonb,$6::jsonb)`,[randomUUID(),input.workspaceId,actorId,asset.id,JSON.stringify({resolutionStatus:"GUIDELINE_MISSING"}),JSON.stringify({resolutionStatus:"PASSED",effectiveDpi:resolution.effectiveDpi,printGuideline:guideline,reason})]);
      await client.query("COMMIT");return{id:asset.id,status:"READY" as const,resolutionStatus:"PASSED" as const,effectiveDpi:resolution.effectiveDpi,duplicate:false};
    }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
  }
}
