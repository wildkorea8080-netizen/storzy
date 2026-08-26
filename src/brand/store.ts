import type { BrandProfileRevision, NewRevisionResult, Workspace } from "./types.js";

export interface BrandProfileStore {
  createWorkspace(input: Readonly<{ name: string; actorId: string }>): Promise<Workspace>;
  listWorkspaces(limit: number): Promise<readonly Workspace[]>;
  findWorkspace(workspaceId: string): Promise<Workspace | null>;
  createRevision(input: Readonly<{
    workspaceId: string;
    onboardingAnswers: Record<string, unknown>;
    actorId: string;
    correlationId: string;
  }>): Promise<NewRevisionResult>;
  findRevision(revisionId: string): Promise<BrandProfileRevision | null>;
  listRevisions(workspaceId: string): Promise<readonly BrandProfileRevision[]>;
  createEditedRevision(input: Readonly<{
    baseRevisionId: string;
    profileData: Record<string, unknown>;
    actorId: string;
  }>): Promise<BrandProfileRevision>;
  completeGeneration(input: Readonly<{
    revisionId: string;
    profileData: Record<string, unknown>;
    promptVersion: string;
    model: string;
    telemetry?: import("./types.js").GenerationTelemetry;
  }>): Promise<BrandProfileRevision>;
  failGeneration(input: Readonly<{ revisionId: string; failureCode: string }>): Promise<BrandProfileRevision>;
  approveRevision(input: Readonly<{ revisionId: string; actorId: string }>): Promise<BrandProfileRevision>;
}
