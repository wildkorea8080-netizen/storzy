import { generationBackoffMs } from "../jobs/retry-policy.js";
import type { Logger } from "../observability/logger.js";
import { evaluateCatalogProduct } from "./evaluator.js";
import type { CandidateJobStore } from "./job-store.js";
import type { CatalogProvider } from "./types.js";
import {PrintfulCatalogConnectionUnavailableError} from "./workspace-printful-catalog.js";

export type CandidateWorkerOptions = Readonly<{
  workerId: string;
  leaseSeconds: number;
  maxAttempts: number;
  pollMs: number;
  currency: string;
  random?: () => number;
}>;

export class CandidateWorker {
  constructor(
    private readonly store: CandidateJobStore,
    private readonly provider: CatalogProvider|Readonly<{forWorkspace(workspaceId:string):Promise<CatalogProvider>}>,
    private readonly logger: Logger,
    private readonly options: CandidateWorkerOptions,
  ) {}

  async processOne(): Promise<boolean> {
    const job = await this.store.claim({
      workerId: this.options.workerId,
      leaseSeconds: this.options.leaseSeconds,
      maxAttempts: this.options.maxAttempts,
    });
    if (!job) return false;
    const log = this.logger.child({ jobId: job.id, revisionId: job.revisionId, correlationId: job.correlationId, attempt: job.attempt });
    if (job.attempt > this.options.maxAttempts) {
      if (!(await this.store.fail({ jobId: job.id, workerId: this.options.workerId, errorCode: "LEASE_EXHAUSTED" }))) {
        throw new Error(`Lost exhausted candidate job: ${job.id}`);
      }
      log.error("candidate-job.failed", { errorCode: "LEASE_EXHAUSTED" });
      return true;
    }

    const heartbeatMs = Math.max(1_000, Math.floor((this.options.leaseSeconds * 1_000) / 3));
    const heartbeat = setInterval(() => {
      void this.store.extendLease({ jobId: job.id, workerId: this.options.workerId, leaseSeconds: this.options.leaseSeconds })
        .then((extended) => {
          if (!extended) log.error("candidate-job.lease-lost");
        })
        .catch((error: unknown) => log.error("candidate-job.heartbeat-failed", { error }));
    }, heartbeatMs);
    heartbeat.unref();

    try {
      const profile = await this.store.loadApprovedProfile(job.revisionId);
      const profileCurrency = String((profile.pricing as Record<string, unknown> | undefined)?.currency ?? this.options.currency).toUpperCase();
      const targetMarkets = Array.isArray(profile.target_markets)
        ? profile.target_markets.flatMap((value) => value && typeof value === "object" && "country_code" in value ? [String(value.country_code).toUpperCase()] : [])
        : [];
      const provider="forWorkspace" in this.provider?await this.provider.forWorkspace(job.workspaceId):this.provider;
      const snapshot = await provider.fetchSnapshot(profileCurrency, targetMarkets);
      const evaluations = snapshot.products.map((product) => evaluateCatalogProduct(profile, product));
      const completed = await this.store.complete({ job, workerId: this.options.workerId, snapshot, evaluations });
      if (!completed) throw new Error(`Lost candidate job lease: ${job.id}`);
      log.info("candidate-job.succeeded", {
        productCount: evaluations.length,
        eligibleCount: evaluations.filter((evaluation) => evaluation.eligibility === "ELIGIBLE").length,
      });
    } catch (error) {
      if(error instanceof PrintfulCatalogConnectionUnavailableError){if(!await this.store.deferConnection({jobId:job.id,workerId:this.options.workerId,delayMs:30_000}))throw new Error(`Lost candidate job before connection defer: ${job.id}`);return true}
      const status = error && typeof error === "object" && "status" in error ? Number((error as { status: unknown }).status) : null;
      const retryAfter=error&&typeof error==="object"&&"retryAfterMs"in error?Number((error as{retryAfterMs:unknown}).retryAfterMs):null;
      if(status===429){const delayMs=Number.isFinite(retryAfter)&&retryAfter!>0?retryAfter!:generationBackoffMs(job.attempt,this.options.random);if(!await this.store.deferRateLimit({jobId:job.id,workerId:this.options.workerId,delayMs}))throw new Error(`Lost candidate job before rate limit defer: ${job.id}`);log.info("candidate-job.rate-limited",{delayMs});return true}
      const retryable = status === null || status === 408 || status >= 500;
      const errorCode = status ? `CATALOG_HTTP_${status}` : error instanceof Error ? error.name : "CATALOG_ERROR";
      if (retryable && job.attempt < this.options.maxAttempts) {
        const delayMs = generationBackoffMs(job.attempt, this.options.random);
        if (!(await this.store.retry({ jobId: job.id, workerId: this.options.workerId, errorCode, delayMs }))) {
          throw new Error(`Lost candidate job before retry: ${job.id}`, { cause: error });
        }
        log.warn("candidate-job.retry-scheduled", { errorCode, delayMs, error });
      } else {
        if (!(await this.store.fail({ jobId: job.id, workerId: this.options.workerId, errorCode }))) {
          throw new Error(`Lost candidate job before failure: ${job.id}`, { cause: error });
        }
        log.error("candidate-job.failed", { errorCode, error });
      }
    } finally {
      clearInterval(heartbeat);
    }
    return true;
  }

  async run(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      const processed = await this.processOne().catch((error: unknown) => {
        this.logger.error("candidate-worker.error", { error });
        return false;
      });
      if (!processed) await sleep(this.options.pollMs, signal);
    }
  }
}

async function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(done, ms);
    const onAbort = () => done();
    function done() {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      resolve();
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
