import { randomUUID } from "node:crypto";
import { ConflictError, NotFoundError } from "./errors.js";
import type { BrandProfileStore } from "./store.js";
import type { BrandProfileRevision, NewRevisionResult, Workspace } from "./types.js";

export class MemoryBrandProfileStore implements BrandProfileStore {
  readonly workspaces = new Map<string, Workspace>();
  readonly revisions = new Map<string, BrandProfileRevision>();
  readonly outbox: Array<{ topic: string; aggregateId: string }> = [];
  private readonly onboardingRequests = new Map<string, NewRevisionResult>();

  async createWorkspace(input: Readonly<{ name: string; actorId: string }>): Promise<Workspace> {
    const workspace: Workspace = { id: randomUUID(), name: input.name, status: "ACTIVE", createdAt: new Date() };
    this.workspaces.set(workspace.id, workspace);
    return workspace;
  }

  async listWorkspaces(limit:number):Promise<readonly Workspace[]>{return [...this.workspaces.values()].sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime()).slice(0,limit)}

  async findWorkspace(workspaceId:string):Promise<Workspace|null>{return this.workspaces.get(workspaceId)??null}

  async createRevision(input: Readonly<{
    workspaceId: string;
    onboardingAnswers: Record<string, unknown>;
    actorId: string;
    correlationId: string;
  }>): Promise<NewRevisionResult> {
    if (!this.workspaces.has(input.workspaceId)) throw new NotFoundError("Workspace");
    const requestKey=`${input.workspaceId}:${input.correlationId}`,prior=this.onboardingRequests.get(requestKey);
    if(prior)return structuredClone(prior);
    const existing = [...this.revisions.values()].filter((revision) => revision.workspaceId === input.workspaceId);
    const revisionNumber = Math.max(0, ...existing.map((revision) => revision.revision)) + 1;
    const revision: BrandProfileRevision = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      brandProfileId: existing[0]?.brandProfileId ?? randomUUID(),
      revision: revisionNumber,
      status: "GENERATING",
      schemaVersion: "1.0.0",
      onboardingAnswers: structuredClone(input.onboardingAnswers),
      profileData: null,
      promptVersion: null,
      model: null,
      failureCode: null,
      createdBy: input.actorId,
      approvedBy: null,
      createdAt: new Date(),
      generatedAt: null,
      approvedAt: null,
    };
    this.revisions.set(revision.id, revision);
    this.outbox.push({ topic: "brand-profile.generation-requested", aggregateId: revision.id });
    const result:NewRevisionResult = {
      revision,
      job: { id: randomUUID(), revisionId: revision.id, status: "PENDING", attempts: 0, correlationId: input.correlationId },
    };
    this.onboardingRequests.set(requestKey,result);
    return structuredClone(result);
  }

  async findRevision(revisionId: string): Promise<BrandProfileRevision | null> {
    return this.revisions.get(revisionId) ?? null;
  }

  async listRevisions(workspaceId: string): Promise<readonly BrandProfileRevision[]> {
    if (!this.workspaces.has(workspaceId)) throw new NotFoundError("Workspace");
    return [...this.revisions.values()]
      .filter((revision) => revision.workspaceId === workspaceId)
      .sort((a, b) => b.revision - a.revision)
      .map((revision) => structuredClone(revision));
  }

  async createEditedRevision(input: Readonly<{
    baseRevisionId: string;
    profileData: Record<string, unknown>;
    actorId: string;
  }>): Promise<BrandProfileRevision> {
    const base = this.revisions.get(input.baseRevisionId);
    if (!base) throw new NotFoundError("Brand profile revision");
    if (!base.profileData || !["REVIEW_REQUIRED", "APPROVED", "SUPERSEDED"].includes(base.status)) {
      throw new ConflictError("INVALID_REVISION_STATE", "Only a completed revision can be edited");
    }
    const revisionNumber = Math.max(0, ...[...this.revisions.values()]
      .filter((revision) => revision.brandProfileId === base.brandProfileId)
      .map((revision) => revision.revision)) + 1;
    const revision: BrandProfileRevision = {
      ...base,
      id: randomUUID(),
      revision: revisionNumber,
      status: "REVIEW_REQUIRED",
      profileData: structuredClone(input.profileData),
      promptVersion: "editor.v1",
      model: "manual",
      failureCode: null,
      createdBy: input.actorId,
      approvedBy: null,
      createdAt: new Date(),
      generatedAt: new Date(),
      approvedAt: null,
    };
    this.revisions.set(revision.id, revision);
    this.outbox.push({ topic: "brand-profile.review-required", aggregateId: revision.id });
    return revision;
  }

  async completeGeneration(input: Readonly<{
    revisionId: string;
    profileData: Record<string, unknown>;
    promptVersion: string;
    model: string;
    telemetry?: import("./types.js").GenerationTelemetry;
  }>): Promise<BrandProfileRevision> {
    const revision = this.revisions.get(input.revisionId);
    if (!revision) throw new NotFoundError("Brand profile revision");
    if (revision.status !== "GENERATING") throw new ConflictError("INVALID_REVISION_STATE", "Only a generating revision can complete");
    const updated: BrandProfileRevision = {
      ...revision,
      status: "REVIEW_REQUIRED",
      profileData: structuredClone(input.profileData),
      promptVersion: input.promptVersion,
      model: input.model,
      generatedAt: new Date(),
    };
    this.revisions.set(updated.id, updated);
    this.outbox.push({ topic: "brand-profile.review-required", aggregateId: updated.id });
    return updated;
  }

  async failGeneration(input: Readonly<{ revisionId: string; failureCode: string }>): Promise<BrandProfileRevision> {
    const revision = this.revisions.get(input.revisionId);
    if (!revision) throw new NotFoundError("Brand profile revision");
    if (revision.status !== "GENERATING") throw new ConflictError("INVALID_REVISION_STATE", "Only a generating revision can fail");
    const updated: BrandProfileRevision = { ...revision, status: "GENERATION_FAILED", failureCode: input.failureCode };
    this.revisions.set(updated.id, updated);
    return updated;
  }

  async approveRevision(input: Readonly<{ revisionId: string; actorId: string }>): Promise<BrandProfileRevision> {
    const revision = this.revisions.get(input.revisionId);
    if (!revision) throw new NotFoundError("Brand profile revision");
    if (revision.status !== "REVIEW_REQUIRED") {
      throw new ConflictError("INVALID_REVISION_STATE", "Only a review-required revision can be approved");
    }
    for (const [id, existing] of this.revisions) {
      if (existing.brandProfileId === revision.brandProfileId && existing.status === "APPROVED") {
        this.revisions.set(id, { ...existing, status: "SUPERSEDED" });
      }
    }
    const updated: BrandProfileRevision = { ...revision, status: "APPROVED", approvedBy: input.actorId, approvedAt: new Date() };
    this.revisions.set(updated.id, updated);
    this.outbox.push({ topic: "brand-profile.approved", aggregateId: updated.id });
    return updated;
  }
}
