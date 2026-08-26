export type CandidateDecision = "UNREVIEWED" | "APPROVED" | "REJECTED";

export type CandidateReviewItem = Readonly<{
  id: string;
  jobId: string;
  externalProductId: string;
  productType: string;
  productName: string;
  eligibility: "ELIGIBLE" | "EXCLUDED";
  exclusionReasons: readonly string[];
  score: number | null;
  scoreBreakdown: Readonly<Record<string, number>> | null;
  evidence: Readonly<Record<string, unknown>>;
  recommendedRetailMinor: number | null;
  variableCostMinor: number;
  currency: string;
  marginBasisPoints: number | null;
  ruleVersion: string;
  decisionStatus: CandidateDecision;
  decisionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  designAsset?: Readonly<{ id:string; fileUrl:string; placement:string; technique:string; mockupStyleIds:readonly number[]; widthPx:number|null; heightPx:number|null; resolutionStatus:"NOT_EVALUATED"|"PASSED"|"GUIDELINE_MISSING"; effectiveDpi:number|null }> | null;
  designOptions?: readonly Readonly<{ placement:string; technique:string; printAreaWidthIn:number; printAreaHeightIn:number; targetDpi:number; allowedMockupStyleIds:readonly number[] }>[];
  mockup?: Readonly<{ status:"PENDING"|"RUNNING"|"WAITING_REMOTE"|"SUCCEEDED"|"FAILED"; attempts:number; lastError:string|null }> | null;
}>;

export type CandidateReviewPage = Readonly<{
  job: Readonly<{
    id: string;
    revisionId: string;
    status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
    catalogSnapshotId: string | null;
    snapshotProvider: string | null;
    snapshotCurrency: string | null;
    snapshotFetchedAt: Date | null;
    lastError: string | null;
  }> | null;
  items: readonly CandidateReviewItem[];
  total: number;
  limit: number;
  offset: number;
}>;

export interface CandidateReviewService {
  list(input: Readonly<{
    workspaceId: string;
    eligibility?: "ELIGIBLE" | "EXCLUDED";
    decisionStatus?: CandidateDecision;
    sort?: "score_desc" | "created_asc";
    limit?: number;
    offset?: number;
  }>): Promise<CandidateReviewPage>;
  decide(input: Readonly<{
    workspaceId: string;
    candidateId: string;
    decision: "APPROVED" | "REJECTED";
    actorId: string;
    reason?: string;
    idempotencyKey: string;
  }>): Promise<CandidateReviewItem | null>;
}
