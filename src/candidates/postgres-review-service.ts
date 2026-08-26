import { randomUUID } from "node:crypto";
import type pg from "pg";
import { DomainError } from "../brand/errors.js";
import type { CandidateDecision, CandidateReviewItem, CandidateReviewPage, CandidateReviewService } from "./review-types.js";

type CandidateRow = {
  id: string; job_id: string; external_product_id: string; product_type: string; product_name: string;
  eligibility: "ELIGIBLE" | "EXCLUDED"; exclusion_reasons: string[]; score: string | null;
  score_breakdown: Record<string, number> | null; evidence: Record<string, unknown>;
  recommended_retail_minor: string | null; variable_cost_minor: string; currency: string;
  margin_basis_points: number | null; rule_version: string; decision_status: CandidateDecision;
  decision_reason: string | null; reviewed_by: string | null; reviewed_at: Date | null; created_at: Date;
  design_asset_id?:string|null;file_url?:string|null;placement?:string|null;technique?:string|null;mockup_style_ids?:number[]|null;
  width_px?:number|null;height_px?:number|null;resolution_status?:"NOT_EVALUATED"|"PASSED"|"GUIDELINE_MISSING";effective_dpi?:string|null;
  snapshot_data?:unknown;
  mockup_status?:"PENDING"|"RUNNING"|"WAITING_REMOTE"|"SUCCEEDED"|"FAILED"|null;mockup_attempts?:number|null;mockup_error?:string|null;
};

const CANDIDATE_FIELDS = `c.id, c.job_id, c.external_product_id, c.product_type, c.product_name,
  c.eligibility, c.exclusion_reasons, c.score, c.score_breakdown, c.evidence,
  c.recommended_retail_minor, c.variable_cost_minor, c.currency, c.margin_basis_points,
  c.rule_version, c.decision_status, c.decision_reason, c.reviewed_by, c.reviewed_at, c.created_at`;

function safeInteger(value: string | null, field: string): number | null {
  if (value === null) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(`${field} exceeds JavaScript safe integer range`);
  return number;
}

function mapCandidate(row: CandidateRow): CandidateReviewItem {
  const snapshot=row.snapshot_data&&typeof row.snapshot_data==="object"&&!Array.isArray(row.snapshot_data)?row.snapshot_data as {products?:unknown}:null;
  const products=Array.isArray(snapshot?.products)?snapshot.products:[];
  const product=products.find(value=>value&&typeof value==="object"&&String((value as {externalProductId?:unknown}).externalProductId)===row.external_product_id) as {placementGuidelines?:unknown}|undefined;
  const designOptions=Array.isArray(product?.placementGuidelines)?product.placementGuidelines.flatMap(value=>{if(!value||typeof value!=="object")return[];const item=value as Record<string,unknown>,placement=String(item.placement??""),technique=String(item.technique??""),width=Number(item.printAreaWidthIn),height=Number(item.printAreaHeightIn),dpi=Number(item.targetDpi),ids=Array.isArray(item.allowedMockupStyleIds)?item.allowedMockupStyleIds.map(Number).filter(id=>Number.isInteger(id)&&id>0):[];return placement&&technique&&width>0&&height>0&&dpi>=150?[{placement,technique,printAreaWidthIn:width,printAreaHeightIn:height,targetDpi:dpi,allowedMockupStyleIds:ids}]:[]}):[];
  return {
    id: row.id, jobId: row.job_id, externalProductId: row.external_product_id,
    productType: row.product_type, productName: row.product_name, eligibility: row.eligibility,
    exclusionReasons: row.exclusion_reasons, score: row.score === null ? null : Number(row.score),
    scoreBreakdown: row.score_breakdown, evidence: row.evidence,
    recommendedRetailMinor: safeInteger(row.recommended_retail_minor, "recommended_retail_minor"),
    variableCostMinor: safeInteger(row.variable_cost_minor, "variable_cost_minor")!, currency: row.currency,
    marginBasisPoints: row.margin_basis_points, ruleVersion: row.rule_version,
    decisionStatus: row.decision_status, decisionReason: row.decision_reason,
    reviewedBy: row.reviewed_by, reviewedAt: row.reviewed_at, createdAt: row.created_at,
    designAsset:row.design_asset_id&&row.file_url&&row.placement&&row.technique?{id:row.design_asset_id,fileUrl:row.file_url,placement:row.placement,technique:row.technique,mockupStyleIds:row.mockup_style_ids??[],widthPx:row.width_px??null,heightPx:row.height_px??null,resolutionStatus:row.resolution_status??"NOT_EVALUATED",effectiveDpi:row.effective_dpi===null||row.effective_dpi===undefined?null:Number(row.effective_dpi)}:null,
    designOptions,
    mockup:row.mockup_status?{status:row.mockup_status,attempts:Number(row.mockup_attempts??0),lastError:row.mockup_error??null}:null,
  };
}

export class PostgresCandidateReviewService implements CandidateReviewService {
  constructor(private readonly pool: pg.Pool) {}

  async list(input: Readonly<{ workspaceId: string; eligibility?: "ELIGIBLE" | "EXCLUDED"; decisionStatus?: CandidateDecision; sort?: "score_desc" | "created_asc"; limit?: number; offset?: number }>): Promise<CandidateReviewPage> {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    const jobResult = await this.pool.query<{
      id: string; revision_id: string; status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
      catalog_snapshot_id: string | null; provider: string | null; currency: string | null; fetched_at: Date | null; last_error: string | null;
    }>(
      `SELECT j.id, j.revision_id, j.status, j.catalog_snapshot_id, s.provider, s.currency, s.fetched_at, j.last_error
       FROM product_candidate_jobs j LEFT JOIN catalog_snapshots s ON s.id = j.catalog_snapshot_id
       WHERE j.workspace_id = $1 ORDER BY j.created_at DESC LIMIT 1`, [input.workspaceId],
    );
    const job = jobResult.rows[0];
    if (!job) return { job: null, items: [], total: 0, limit, offset };
    const filters = [job.id, input.eligibility ?? null, input.decisionStatus ?? null];
    const count = await this.pool.query<{ count: string }>(
      `SELECT count(*) FROM product_candidates c WHERE c.job_id = $1
       AND ($2::text IS NULL OR c.eligibility = $2) AND ($3::text IS NULL OR c.decision_status = $3)`, filters,
    );
    const order = input.sort === "created_asc" ? "c.created_at ASC, c.id ASC" : "c.score DESC NULLS LAST, c.id ASC";
    const rows = await this.pool.query<CandidateRow>(
      `SELECT ${CANDIDATE_FIELDS},da.id design_asset_id,da.file_url,da.placement,da.technique,da.mockup_style_ids,da.width_px,da.height_px,da.resolution_status,da.effective_dpi,cs.data snapshot_data,
       mj.status mockup_status,mj.attempts mockup_attempts,mj.last_error mockup_error
       FROM product_candidates c JOIN catalog_snapshots cs ON cs.id=c.catalog_snapshot_id LEFT JOIN design_assets da ON da.candidate_id=c.id
       LEFT JOIN LATERAL(SELECT j.status,j.attempts,j.last_error FROM printful_mockup_jobs j WHERE j.design_asset_id=da.id ORDER BY j.created_at DESC LIMIT 1)mj ON true
       WHERE c.job_id = $1
       AND ($2::text IS NULL OR c.eligibility = $2) AND ($3::text IS NULL OR c.decision_status = $3)
       ORDER BY ${order} LIMIT $4 OFFSET $5`, [...filters, limit, offset],
    );
    return {
      job: { id: job.id, revisionId: job.revision_id, status: job.status, catalogSnapshotId: job.catalog_snapshot_id,
        snapshotProvider: job.provider, snapshotCurrency: job.currency, snapshotFetchedAt: job.fetched_at, lastError: job.last_error },
      items: rows.rows.map(mapCandidate), total: Number(count.rows[0]?.count ?? 0), limit, offset,
    };
  }

  async decide(input: Readonly<{ workspaceId: string; candidateId: string; decision: "APPROVED" | "REJECTED"; actorId: string; reason?: string; idempotencyKey: string }>): Promise<CandidateReviewItem | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query<{ candidate_id: string; workspace_id: string; action: string }>(
        "SELECT candidate_id, workspace_id, action FROM product_candidate_actions WHERE idempotency_key = $1", [input.idempotencyKey],
      );
      const prior = existing.rows[0];
      if (prior && (prior.candidate_id !== input.candidateId || prior.workspace_id !== input.workspaceId || prior.action !== input.decision)) {
        throw new DomainError("IDEMPOTENCY_CONFLICT", "idempotencyKey was already used for another candidate decision");
      }
      const selected = await client.query<CandidateRow>(
        `SELECT ${CANDIDATE_FIELDS} FROM product_candidates c
         JOIN product_candidate_jobs j ON j.id = c.job_id
         WHERE c.id = $1 AND j.workspace_id = $2 FOR UPDATE OF c`, [input.candidateId, input.workspaceId],
      );
      const row = selected.rows[0];
      if (!row) { await client.query("ROLLBACK"); return null; }
      if (prior) { await client.query("COMMIT"); return mapCandidate(row); }
      if (input.decision === "APPROVED" && row.eligibility !== "ELIGIBLE") {
        throw new DomainError("CANDIDATE_INELIGIBLE", "Excluded candidate cannot be approved");
      }
      if (row.decision_status !== "UNREVIEWED" && row.decision_status !== input.decision) {
        throw new DomainError("CANDIDATE_ALREADY_DECIDED", `Candidate is already ${row.decision_status.toLowerCase()}`);
      }
      const updated = row.decision_status === "UNREVIEWED"
        ? await client.query<CandidateRow>(
          `UPDATE product_candidates c SET decision_status = $2, decision_reason = $3, reviewed_by = $4, reviewed_at = now()
           WHERE c.id = $1 RETURNING ${CANDIDATE_FIELDS}`,
          [input.candidateId, input.decision, input.reason ?? null, input.actorId],
        )
        : selected;
      if (input.decision === "APPROVED" && row.decision_status === "UNREVIEWED") {
        await client.query(
          `INSERT INTO product_content_jobs (id, candidate_id, workspace_id, correlation_id)
           VALUES ($1, $2, $3, $4) ON CONFLICT (candidate_id) DO NOTHING`,
          [randomUUID(), input.candidateId, input.workspaceId, input.idempotencyKey],
        );
      }
      await client.query(
        `INSERT INTO product_candidate_actions (id, candidate_id, workspace_id, action, actor_id, reason, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [randomUUID(), input.candidateId, input.workspaceId, input.decision, input.actorId, input.reason ?? null, input.idempotencyKey],
      );
      await client.query("COMMIT");
      return mapCandidate(updated.rows[0]!);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }
}
