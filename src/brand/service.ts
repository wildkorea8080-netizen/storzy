import { randomUUID } from "node:crypto";
import { assertSchema } from "../ai/schema-registry.js";
import { ConflictError, NotFoundError } from "./errors.js";
import type { BrandProfileStore } from "./store.js";
import type { BrandProfileRevision, NewRevisionResult, Workspace } from "./types.js";

export interface BrandProfileGenerator {
  generate(onboardingAnswers: Record<string, unknown>): Promise<Readonly<{
    profileData: Record<string, unknown>;
    promptVersion: string;
    model: string;
    telemetry?: import("./types.js").GenerationTelemetry;
  }>>;
}

function normalizeRequiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim()) throw new ConflictError("INVALID_INPUT", `${field} is required`);
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new ConflictError("INVALID_INPUT", `${field} is too long`);
  return normalized;
}

function validateAnswers(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ConflictError("INVALID_INPUT", "answers must be an object");
  }
  const answers = value as Record<string, unknown>;
  if (Object.keys(answers).length === 0) throw new ConflictError("INVALID_INPUT", "answers must not be empty");
  if (Buffer.byteLength(JSON.stringify(answers), "utf8") > 65_536) {
    throw new ConflictError("INVALID_INPUT", "answers exceed 64 KiB");
  }
  return answers;
}

export class BrandProfileService {
  constructor(private readonly store: BrandProfileStore) {}

  listWorkspaces(limit=50):Promise<readonly Workspace[]>{if(!Number.isInteger(limit)||limit<1||limit>100)throw new ConflictError("INVALID_INPUT","limit must be between 1 and 100");return this.store.listWorkspaces(limit)}

  async getWorkspace(workspaceId:unknown):Promise<Workspace>{const id=normalizeRequiredText(workspaceId,"workspaceId",100),workspace=await this.store.findWorkspace(id);if(!workspace)throw new NotFoundError("Workspace");return workspace}

  createWorkspace(input: Readonly<{ name: unknown; actorId: unknown }>): Promise<Workspace> {
    return this.store.createWorkspace({
      name: normalizeRequiredText(input.name, "name", 120),
      actorId: normalizeRequiredText(input.actorId, "actorId", 200),
    });
  }

  submitOnboarding(input: Readonly<{
    workspaceId: unknown;
    answers: unknown;
    actorId: unknown;
    correlationId?: unknown;
  }>): Promise<NewRevisionResult> {
    return this.store.createRevision({
      workspaceId: normalizeRequiredText(input.workspaceId, "workspaceId", 100),
      onboardingAnswers: validateAnswers(input.answers),
      actorId: normalizeRequiredText(input.actorId, "actorId", 200),
      correlationId:
        input.correlationId === undefined
          ? randomUUID()
          : normalizeRequiredText(input.correlationId, "correlationId", 200),
    });
  }

  async getRevision(revisionId: unknown): Promise<BrandProfileRevision> {
    const id = normalizeRequiredText(revisionId, "revisionId", 100);
    const revision = await this.store.findRevision(id);
    if (!revision) throw new NotFoundError("Brand profile revision");
    return revision;
  }

  listRevisions(workspaceId: unknown): Promise<readonly BrandProfileRevision[]> {
    return this.store.listRevisions(normalizeRequiredText(workspaceId, "workspaceId", 100));
  }

  createEditedRevision(input: Readonly<{
    baseRevisionId: unknown;
    profileData: unknown;
    actorId: unknown;
  }>): Promise<BrandProfileRevision> {
    if (!input.profileData || typeof input.profileData !== "object" || Array.isArray(input.profileData)) {
      throw new ConflictError("INVALID_INPUT", "profileData must be an object");
    }
    const profileData = input.profileData as Record<string, unknown>;
    assertSchema("brandProfile", profileData);
    return this.store.createEditedRevision({
      baseRevisionId: normalizeRequiredText(input.baseRevisionId, "baseRevisionId", 100),
      profileData,
      actorId: normalizeRequiredText(input.actorId, "actorId", 200),
    });
  }

  approveRevision(input: Readonly<{ revisionId: unknown; actorId: unknown }>): Promise<BrandProfileRevision> {
    return this.store.approveRevision({
      revisionId: normalizeRequiredText(input.revisionId, "revisionId", 100),
      actorId: normalizeRequiredText(input.actorId, "actorId", 200),
    });
  }

  async generateForRevision(revisionId: string, generator: BrandProfileGenerator): Promise<BrandProfileRevision> {
    const generated = await this.generatePayload(revisionId, generator);
    return this.store.completeGeneration({ revisionId, ...generated });
  }

  private async generatePayload(revisionId: string, generator: BrandProfileGenerator) {
    const revision = await this.getRevision(revisionId);
    if (revision.status !== "GENERATING") throw new ConflictError("INVALID_REVISION_STATE", "Revision is not generating");
    const generated = await generator.generate(revision.onboardingAnswers);
    assertSchema("brandProfile", generated.profileData);
    return generated;
  }

  markGenerationFailed(revisionId: string, failureCode: string): Promise<BrandProfileRevision> {
    return this.store.failGeneration({ revisionId, failureCode });
  }

  async runGeneration(revisionId: string, generator: BrandProfileGenerator): Promise<BrandProfileRevision> {
    let generated: Awaited<ReturnType<BrandProfileGenerator["generate"]>>;
    try {
      generated = await this.generatePayload(revisionId, generator);
    } catch (error) {
      const failureCode = error instanceof Error && error.message.includes("validation failed") ? "SCHEMA_VALIDATION_FAILED" : "GENERATION_FAILED";
      await this.store.failGeneration({ revisionId, failureCode });
      throw error;
    }
    return this.store.completeGeneration({ revisionId, ...generated });
  }
}
