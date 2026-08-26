import { randomUUID } from "node:crypto";
import type pg from "pg";
import { ConflictError, NotFoundError } from "./errors.js";
import type { BrandProfileStore } from "./store.js";
import type { BrandProfileRevision, GenerationJob, NewRevisionResult, Workspace } from "./types.js";

type RevisionRow = {
  id: string;
  workspace_id: string;
  brand_profile_id: string;
  revision: number;
  status: BrandProfileRevision["status"];
  schema_version: string;
  onboarding_answers: Record<string, unknown>;
  profile_data: Record<string, unknown> | null;
  prompt_version: string | null;
  model: string | null;
  failure_code: string | null;
  created_by: string;
  approved_by: string | null;
  created_at: Date;
  generated_at: Date | null;
  approved_at: Date | null;
};

const REVISION_SELECT = `
  SELECT r.*, p.workspace_id
  FROM brand_profile_revisions r
  JOIN brand_profiles p ON p.id = r.brand_profile_id
`;

function mapRevision(row: RevisionRow): BrandProfileRevision {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    brandProfileId: row.brand_profile_id,
    revision: row.revision,
    status: row.status,
    schemaVersion: row.schema_version,
    onboardingAnswers: row.onboarding_answers,
    profileData: row.profile_data,
    promptVersion: row.prompt_version,
    model: row.model,
    failureCode: row.failure_code,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    createdAt: row.created_at,
    generatedAt: row.generated_at,
    approvedAt: row.approved_at,
  };
}

async function transaction<T>(pool: pg.Pool, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export class PostgresBrandProfileStore implements BrandProfileStore {
  constructor(private readonly pool: pg.Pool) {}

  async listWorkspaces(limit:number):Promise<readonly Workspace[]>{
    const result=await this.pool.query<{id:string;name:string;status:Workspace["status"];created_at:Date}>("SELECT id,name,status,created_at FROM workspaces ORDER BY updated_at DESC,id ASC LIMIT $1",[limit]);
    return result.rows.map(row=>({id:row.id,name:row.name,status:row.status,createdAt:row.created_at}));
  }

  async findWorkspace(workspaceId:string):Promise<Workspace|null>{
    const result=await this.pool.query<{id:string;name:string;status:Workspace["status"];created_at:Date}>("SELECT id,name,status,created_at FROM workspaces WHERE id=$1",[workspaceId]);
    const row=result.rows[0];return row?{id:row.id,name:row.name,status:row.status,createdAt:row.created_at}:null;
  }

  async createWorkspace(input: Readonly<{ name: string; actorId: string }>): Promise<Workspace> {
    return transaction(this.pool, async (client) => {
      const id = randomUUID();
      const result = await client.query<{ id: string; name: string; status: Workspace["status"]; created_at: Date }>(
        "INSERT INTO workspaces (id, name) VALUES ($1, $2) RETURNING id, name, status, created_at",
        [id, input.name],
      );
      const row = result.rows[0];
      if (!row) throw new Error("Workspace insert returned no row");
      await client.query(
        `INSERT INTO audit_events (id, workspace_id, actor_id, action, target_type, target_id, after_data)
         VALUES ($1, $2, $3, 'workspace.created', 'workspace', $2, $4::jsonb)`,
        [randomUUID(), id, input.actorId, JSON.stringify({ name: input.name, status: row.status })],
      );
      return { id: row.id, name: row.name, status: row.status, createdAt: row.created_at };
    });
  }

  async createRevision(input: Readonly<{
    workspaceId: string;
    onboardingAnswers: Record<string, unknown>;
    actorId: string;
    correlationId: string;
  }>): Promise<NewRevisionResult> {
    return transaction(this.pool, async (client) => {
      const workspace = await client.query<{ status: Workspace["status"] }>(
        "SELECT status FROM workspaces WHERE id = $1 FOR UPDATE",
        [input.workspaceId],
      );
      if (!workspace.rows[0]) throw new NotFoundError("Workspace");
      if (workspace.rows[0].status !== "ACTIVE") throw new ConflictError("WORKSPACE_INACTIVE", "Workspace is not active");

      const profileId = randomUUID();
      const profile = await client.query<{ id: string }>(
        `INSERT INTO brand_profiles (id, workspace_id) VALUES ($1, $2)
         ON CONFLICT (workspace_id) DO UPDATE SET updated_at = now()
         RETURNING id`,
        [profileId, input.workspaceId],
      );
      const persistedProfileId = profile.rows[0]?.id;
      if (!persistedProfileId) throw new Error("Brand profile upsert returned no row");

      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",[`${input.workspaceId}:${input.correlationId}`]);
      const existing=await client.query<{revision_id:string;job_id:string;status:GenerationJob["status"];attempts:number;correlation_id:string}>(`SELECT r.id revision_id,j.id job_id,j.status,j.attempts,j.correlation_id FROM brand_profile_revisions r JOIN generation_jobs j ON j.revision_id=r.id WHERE r.brand_profile_id=$1 AND r.onboarding_idempotency_key=$2`,[persistedProfileId,input.correlationId]);
      if(existing.rows[0]){const row=existing.rows[0],revision=await this.findRevisionWithClient(client,row.revision_id);if(!revision)throw new Error("Idempotent revision was not found");return{revision,job:{id:row.job_id,revisionId:row.revision_id,status:row.status,attempts:row.attempts,correlationId:row.correlation_id}};}

      const next = await client.query<{ revision: number }>(
        "SELECT COALESCE(MAX(revision), 0) + 1 AS revision FROM brand_profile_revisions WHERE brand_profile_id = $1",
        [persistedProfileId],
      );
      const revisionNumber = Number(next.rows[0]?.revision ?? 1);
      const revisionId = randomUUID();
      const jobId = randomUUID();
      await client.query(
        `INSERT INTO brand_profile_revisions
          (id, brand_profile_id, revision, status, onboarding_answers, created_by, onboarding_idempotency_key)
         VALUES ($1, $2, $3, 'GENERATING', $4::jsonb, $5, $6)`,
        [revisionId, persistedProfileId, revisionNumber, JSON.stringify(input.onboardingAnswers), input.actorId, input.correlationId],
      );
      await client.query(
        `INSERT INTO generation_jobs (id, revision_id, job_type, correlation_id)
         VALUES ($1, $2, 'BRAND_PROFILE_GENERATION', $3)`,
        [jobId, revisionId, input.correlationId],
      );
      await client.query(
        `INSERT INTO outbox_events
          (id, topic, aggregate_type, aggregate_id, payload, idempotency_key, correlation_id)
         VALUES ($1, 'brand-profile.generation-requested', 'brand_profile_revision', $2, $3::jsonb, $4, $5)`,
        [randomUUID(), revisionId, JSON.stringify({ revisionId, jobId }), `brand-profile-generation:${revisionId}`, input.correlationId],
      );
      await client.query(
        `INSERT INTO audit_events
          (id, workspace_id, actor_id, action, target_type, target_id, after_data)
         VALUES ($1, $2, $3, 'brand-profile.revision-created', 'brand_profile_revision', $4, $5::jsonb)`,
        [randomUUID(), input.workspaceId, input.actorId, revisionId, JSON.stringify({ revision: revisionNumber, status: "GENERATING" })],
      );
      const revision = await this.findRevisionWithClient(client, revisionId);
      if (!revision) throw new Error("Revision insert returned no row");
      const job: GenerationJob = { id: jobId, revisionId, status: "PENDING", attempts: 0, correlationId: input.correlationId };
      return { revision, job };
    });
  }

  findRevision(revisionId: string): Promise<BrandProfileRevision | null> {
    return this.findRevisionWithClient(this.pool, revisionId);
  }

  async listRevisions(workspaceId: string): Promise<readonly BrandProfileRevision[]> {
    const workspace = await this.pool.query("SELECT 1 FROM workspaces WHERE id = $1", [workspaceId]);
    if (!workspace.rowCount) throw new NotFoundError("Workspace");
    const result = await this.pool.query<RevisionRow>(
      `${REVISION_SELECT} WHERE p.workspace_id = $1 ORDER BY r.revision DESC LIMIT 50`,
      [workspaceId],
    );
    return result.rows.map(mapRevision);
  }

  private async findRevisionWithClient(client: pg.Pool | pg.PoolClient, revisionId: string): Promise<BrandProfileRevision | null> {
    const result = await client.query<RevisionRow>(`${REVISION_SELECT} WHERE r.id = $1`, [revisionId]);
    return result.rows[0] ? mapRevision(result.rows[0]) : null;
  }

  async createEditedRevision(input: Readonly<{
    baseRevisionId: string;
    profileData: Record<string, unknown>;
    actorId: string;
  }>): Promise<BrandProfileRevision> {
    return transaction(this.pool, async (client) => {
      const current = await client.query<RevisionRow>(`${REVISION_SELECT} WHERE r.id = $1 FOR UPDATE OF r`, [input.baseRevisionId]);
      const base = current.rows[0];
      if (!base) throw new NotFoundError("Brand profile revision");
      if (!base.profile_data || !["REVIEW_REQUIRED", "APPROVED", "SUPERSEDED"].includes(base.status)) {
        throw new ConflictError("INVALID_REVISION_STATE", "Only a completed revision can be edited");
      }
      await client.query("SELECT id FROM brand_profiles WHERE id = $1 FOR UPDATE", [base.brand_profile_id]);
      const next = await client.query<{ revision: number }>(
        "SELECT COALESCE(MAX(revision), 0) + 1 AS revision FROM brand_profile_revisions WHERE brand_profile_id = $1",
        [base.brand_profile_id],
      );
      const revisionNumber = Number(next.rows[0]?.revision ?? 1);
      const revisionId = randomUUID();
      await client.query(
        `INSERT INTO brand_profile_revisions
          (id, brand_profile_id, revision, status, schema_version, onboarding_answers, profile_data,
           prompt_version, model, created_by, generated_at)
         VALUES ($1, $2, $3, 'REVIEW_REQUIRED', $4, $5::jsonb, $6::jsonb, 'editor.v1', 'manual', $7, now())`,
        [revisionId, base.brand_profile_id, revisionNumber, base.schema_version, JSON.stringify(base.onboarding_answers), JSON.stringify(input.profileData), input.actorId],
      );
      await client.query(
        `INSERT INTO audit_events
          (id, workspace_id, actor_id, action, target_type, target_id, before_data, after_data)
         VALUES ($1, $2, $3, 'brand-profile.editor-revision-created', 'brand_profile_revision', $4, $5::jsonb, $6::jsonb)`,
        [randomUUID(), base.workspace_id, input.actorId, revisionId,
          JSON.stringify({ baseRevisionId: input.baseRevisionId, revision: base.revision }),
          JSON.stringify({ revision: revisionNumber, status: "REVIEW_REQUIRED" })],
      );
      await client.query(
        `INSERT INTO outbox_events
          (id, topic, aggregate_type, aggregate_id, payload, idempotency_key, correlation_id)
         VALUES ($1, 'brand-profile.review-required', 'brand_profile_revision', $2, $3::jsonb, $4, $5)`,
        [randomUUID(), revisionId, JSON.stringify({ revisionId, baseRevisionId: input.baseRevisionId }), `brand-profile-review:${revisionId}`, randomUUID()],
      );
      const revision = await this.findRevisionWithClient(client, revisionId);
      if (!revision) throw new Error("Edited revision insert returned no row");
      return revision;
    });
  }

  async completeGeneration(input: Readonly<{
    revisionId: string;
    profileData: Record<string, unknown>;
    promptVersion: string;
    model: string;
    telemetry?: import("./types.js").GenerationTelemetry;
  }>): Promise<BrandProfileRevision> {
    return transaction(this.pool, async (client) => {
      const current = await client.query<RevisionRow>(`${REVISION_SELECT} WHERE r.id = $1 FOR UPDATE OF r`, [input.revisionId]);
      const row = current.rows[0];
      if (!row) throw new NotFoundError("Brand profile revision");
      if (row.status !== "GENERATING") throw new ConflictError("INVALID_REVISION_STATE", "Only a generating revision can complete");
      await client.query(
        `UPDATE brand_profile_revisions
         SET status = 'REVIEW_REQUIRED', profile_data = $2::jsonb, prompt_version = $3, model = $4, generated_at = now()
         WHERE id = $1`,
        [input.revisionId, JSON.stringify(input.profileData), input.promptVersion, input.model],
      );
      await client.query(
        `UPDATE generation_jobs
         SET status = 'SUCCEEDED', finished_at = now(), locked_by = NULL, lease_expires_at = NULL,
             provider_request_id = $2, latency_ms = $3, input_tokens = $4, output_tokens = $5, total_tokens = $6
         WHERE revision_id = $1`,
        [
          input.revisionId,
          input.telemetry?.providerRequestId ?? null,
          input.telemetry?.latencyMs ?? null,
          input.telemetry?.inputTokens ?? null,
          input.telemetry?.outputTokens ?? null,
          input.telemetry?.totalTokens ?? null,
        ],
      );
      await client.query(
        `INSERT INTO outbox_events
          (id, topic, aggregate_type, aggregate_id, payload, idempotency_key, correlation_id)
         SELECT $1, 'brand-profile.review-required', 'brand_profile_revision', $2, $3::jsonb, $4, correlation_id
         FROM generation_jobs WHERE revision_id = $2`,
        [randomUUID(), input.revisionId, JSON.stringify({ revisionId: input.revisionId }), `brand-profile-review:${input.revisionId}`],
      );
      const updated = await this.findRevisionWithClient(client, input.revisionId);
      if (!updated) throw new Error("Completed revision was not found");
      return updated;
    });
  }

  async failGeneration(input: Readonly<{ revisionId: string; failureCode: string }>): Promise<BrandProfileRevision> {
    return transaction(this.pool, async (client) => {
      const result = await client.query(
        `UPDATE brand_profile_revisions
         SET status = 'GENERATION_FAILED', failure_code = $2
         WHERE id = $1 AND status = 'GENERATING'`,
        [input.revisionId, input.failureCode],
      );
      if (!result.rowCount) throw new ConflictError("INVALID_REVISION_STATE", "Generating revision was not found");
      await client.query(
        `UPDATE generation_jobs
         SET status = 'FAILED', last_error = $2, finished_at = now(), locked_by = NULL, lease_expires_at = NULL
         WHERE revision_id = $1`,
        [input.revisionId, input.failureCode],
      );
      const updated = await this.findRevisionWithClient(client, input.revisionId);
      if (!updated) throw new NotFoundError("Brand profile revision");
      return updated;
    });
  }

  async approveRevision(input: Readonly<{ revisionId: string; actorId: string }>): Promise<BrandProfileRevision> {
    return transaction(this.pool, async (client) => {
      const current = await client.query<RevisionRow>(`${REVISION_SELECT} WHERE r.id = $1 FOR UPDATE OF r`, [input.revisionId]);
      const row = current.rows[0];
      if (!row) throw new NotFoundError("Brand profile revision");
      if (row.status !== "REVIEW_REQUIRED") {
        throw new ConflictError("INVALID_REVISION_STATE", "Only a review-required revision can be approved");
      }
      await client.query("SELECT id FROM brand_profiles WHERE id = $1 FOR UPDATE", [row.brand_profile_id]);
      await client.query(
        `UPDATE brand_profile_revisions SET status = 'SUPERSEDED'
         WHERE brand_profile_id = $1 AND status = 'APPROVED'`,
        [row.brand_profile_id],
      );
      await client.query(
        `UPDATE brand_profile_revisions
         SET status = 'APPROVED', approved_by = $2, approved_at = now()
         WHERE id = $1`,
        [input.revisionId, input.actorId],
      );
      await client.query(
        `INSERT INTO audit_events
          (id, workspace_id, actor_id, action, target_type, target_id, before_data, after_data)
         VALUES ($1, $2, $3, 'brand-profile.approved', 'brand_profile_revision', $4, $5::jsonb, $6::jsonb)`,
        [
          randomUUID(),
          row.workspace_id,
          input.actorId,
          input.revisionId,
          JSON.stringify({ status: row.status }),
          JSON.stringify({ status: "APPROVED", revision: row.revision }),
        ],
      );
      await client.query(
        `INSERT INTO outbox_events
          (id, topic, aggregate_type, aggregate_id, payload, idempotency_key, correlation_id)
         VALUES ($1, 'brand-profile.approved', 'brand_profile_revision', $2, $3::jsonb, $4,
           COALESCE((SELECT correlation_id FROM generation_jobs WHERE revision_id = $2 LIMIT 1), $5))`,
        [randomUUID(), input.revisionId, JSON.stringify({ revisionId: input.revisionId }), `brand-profile-approved:${input.revisionId}`, randomUUID()],
      );
      const updated = await this.findRevisionWithClient(client, input.revisionId);
      if (!updated) throw new Error("Approved revision was not found");
      return updated;
    });
  }
}
