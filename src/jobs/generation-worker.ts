import type { BrandProfileGenerator, BrandProfileService } from "../brand/service.js";
import { classifyGenerationError, generationBackoffMs } from "./retry-policy.js";
import type { GenerationJobQueue } from "./types.js";

export type GenerationWorkerOptions = Readonly<{
  workerId: string;
  leaseSeconds: number;
  maxAttempts: number;
  pollMs: number;
  random?: () => number;
  onError?: (error: unknown) => void;
}>;

export class GenerationWorker {
  constructor(
    private readonly queue: GenerationJobQueue,
    private readonly service: BrandProfileService,
    private readonly generator: BrandProfileGenerator,
    private readonly options: GenerationWorkerOptions,
  ) {}

  async processOne(): Promise<boolean> {
    const job = await this.queue.claim({
      workerId: this.options.workerId,
      leaseSeconds: this.options.leaseSeconds,
      maxAttempts: this.options.maxAttempts,
    });
    if (!job) return false;

    if (job.attempt > this.options.maxAttempts) {
      await this.service.markGenerationFailed(job.revisionId, "LEASE_EXHAUSTED");
      const acknowledged = await this.queue.acknowledgeFailure({
        jobId: job.id,
        workerId: this.options.workerId,
        errorCode: "LEASE_EXHAUSTED",
      });
      if (!acknowledged) throw new Error(`Could not acknowledge exhausted generation job: ${job.id}`);
      return true;
    }

    const heartbeatMs = Math.max(1_000, Math.floor((this.options.leaseSeconds * 1_000) / 3));
    const heartbeat = setInterval(() => {
      void this.queue
        .extendLease({ jobId: job.id, workerId: this.options.workerId, leaseSeconds: this.options.leaseSeconds })
        .then((extended) => {
          if (!extended) this.options.onError?.(new Error(`Lost generation job lease: ${job.id}`));
        })
        .catch((error: unknown) => this.options.onError?.(error));
    }, heartbeatMs);
    heartbeat.unref();

    try {
      try {
        await this.service.generateForRevision(job.revisionId, this.generator);
      } catch (error) {
        const disposition = classifyGenerationError(error);
        if (disposition.retryable && job.attempt < this.options.maxAttempts) {
          const scheduled = await this.queue.retry({
            jobId: job.id,
            workerId: this.options.workerId,
            errorCode: disposition.code,
            delayMs: generationBackoffMs(job.attempt, this.options.random),
          });
          if (!scheduled) throw new Error(`Lost generation job before retry: ${job.id}`, { cause: error });
        } else {
          await this.service.markGenerationFailed(job.revisionId, disposition.code);
          const acknowledged = await this.queue.acknowledgeFailure({
            jobId: job.id,
            workerId: this.options.workerId,
            errorCode: disposition.code,
          });
          if (!acknowledged) throw new Error(`Could not acknowledge failed generation job: ${job.id}`, { cause: error });
        }
        return true;
      }
      const acknowledged = await this.queue.acknowledgeSuccess({ jobId: job.id, workerId: this.options.workerId });
      if (!acknowledged) throw new Error(`Could not acknowledge successful generation job: ${job.id}`);
    } finally {
      clearInterval(heartbeat);
    }
    return true;
  }

  async run(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        const processed = await this.processOne();
        if (!processed) await sleep(this.options.pollMs, signal);
      } catch (error) {
        this.options.onError?.(error);
        await sleep(this.options.pollMs, signal);
      }
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
