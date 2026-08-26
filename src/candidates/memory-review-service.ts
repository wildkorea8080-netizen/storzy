import { DomainError } from "../brand/errors.js";
import type { CandidateDecision, CandidateReviewItem, CandidateReviewPage, CandidateReviewService } from "./review-types.js";

export class MemoryCandidateReviewService implements CandidateReviewService {
  readonly items = new Map<string, CandidateReviewItem & { workspaceId: string }>();
  readonly idempotency = new Map<string, { workspaceId: string; candidateId: string; decision: string }>();
  job: CandidateReviewPage["job"] = null;

  async list(input: Readonly<{ workspaceId: string; eligibility?: "ELIGIBLE" | "EXCLUDED"; decisionStatus?: CandidateDecision; sort?: "score_desc" | "created_asc"; limit?: number; offset?: number }>): Promise<CandidateReviewPage> {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    const all = [...this.items.values()]
      .filter((item) => item.workspaceId === input.workspaceId && (!input.eligibility || item.eligibility === input.eligibility) && (!input.decisionStatus || item.decisionStatus === input.decisionStatus))
      .sort(input.sort === "created_asc"
        ? (left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id)
        : (left, right) => (right.score ?? -Infinity) - (left.score ?? -Infinity) || left.id.localeCompare(right.id));
    return { job: this.job, items: all.slice(offset, offset + limit), total: all.length, limit, offset };
  }

  async decide(input: Readonly<{ workspaceId: string; candidateId: string; decision: "APPROVED" | "REJECTED"; actorId: string; reason?: string; idempotencyKey: string }>): Promise<CandidateReviewItem | null> {
    const prior = this.idempotency.get(input.idempotencyKey);
    if (prior && (prior.workspaceId !== input.workspaceId || prior.candidateId !== input.candidateId || prior.decision !== input.decision)) {
      throw new DomainError("IDEMPOTENCY_CONFLICT", "idempotencyKey was already used for another candidate decision");
    }
    const item = this.items.get(input.candidateId);
    if (!item || item.workspaceId !== input.workspaceId) return null;
    if (prior) return item;
    if (input.decision === "APPROVED" && item.eligibility !== "ELIGIBLE") throw new DomainError("CANDIDATE_INELIGIBLE", "Excluded candidate cannot be approved");
    if (item.decisionStatus !== "UNREVIEWED" && item.decisionStatus !== input.decision) {
      throw new DomainError("CANDIDATE_ALREADY_DECIDED", `Candidate is already ${item.decisionStatus.toLowerCase()}`);
    }
    const updated = item.decisionStatus === "UNREVIEWED" ? {
      ...item, decisionStatus: input.decision, decisionReason: input.reason ?? null, reviewedBy: input.actorId, reviewedAt: new Date(),
    } satisfies CandidateReviewItem & { workspaceId: string } : item;
    this.items.set(item.id, updated);
    this.idempotency.set(input.idempotencyKey, { workspaceId: input.workspaceId, candidateId: input.candidateId, decision: input.decision });
    return updated;
  }
}
