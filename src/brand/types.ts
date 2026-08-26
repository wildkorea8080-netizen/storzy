export type BrandProfileRevisionStatus =
  | "GENERATING"
  | "REVIEW_REQUIRED"
  | "APPROVED"
  | "SUPERSEDED"
  | "GENERATION_FAILED";

export type Workspace = Readonly<{
  id: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED" | "CLOSED";
  createdAt: Date;
}>;

export type BrandProfileRevision = Readonly<{
  id: string;
  workspaceId: string;
  brandProfileId: string;
  revision: number;
  status: BrandProfileRevisionStatus;
  schemaVersion: string;
  onboardingAnswers: Record<string, unknown>;
  profileData: Record<string, unknown> | null;
  promptVersion: string | null;
  model: string | null;
  failureCode: string | null;
  createdBy: string;
  approvedBy: string | null;
  createdAt: Date;
  generatedAt: Date | null;
  approvedAt: Date | null;
}>;

export type GenerationJob = Readonly<{
  id: string;
  revisionId: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  attempts: number;
  correlationId: string;
}>;

export type GenerationTelemetry = Readonly<{
  providerRequestId: string | null;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}>;

export type NewRevisionResult = Readonly<{
  revision: BrandProfileRevision;
  job: GenerationJob;
}>;
