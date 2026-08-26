import { generationBackoffMs } from "../jobs/retry-policy.js";
import type { Logger } from "../observability/logger.js";
import { PermanentDeliveryError } from "./event-sinks.js";
import type { EventSink, OutboxQueue } from "./types.js";

export type OutboxPublisherOptions = Readonly<{
  workerId: string;
  leaseSeconds: number;
  maxAttempts: number;
  pollMs: number;
  random?: () => number;
}>;

export class OutboxPublisher {
  constructor(
    private readonly queue: OutboxQueue,
    private readonly sink: EventSink,
    private readonly logger: Logger,
    private readonly options: OutboxPublisherOptions,
  ) {}

  async processOne(): Promise<boolean> {
    const event = await this.queue.claim({
      workerId: this.options.workerId,
      leaseSeconds: this.options.leaseSeconds,
      maxAttempts: this.options.maxAttempts,
    });
    if (!event) return false;
    const log = this.logger.child({
      eventId: event.id,
      topic: event.topic,
      aggregateId: event.aggregateId,
      correlationId: event.correlationId,
      attempt: event.attempt,
    });

    if (event.attempt > this.options.maxAttempts) {
      await this.requireTransition(
        this.queue.deadLetter({ eventId: event.id, workerId: this.options.workerId, errorCode: "LEASE_EXHAUSTED" }),
        "dead-letter exhausted event",
      );
      log.error("outbox.dead-lettered", { errorCode: "LEASE_EXHAUSTED" });
      return true;
    }

    try {
      await this.sink.publish(event);
      await this.requireTransition(
        this.queue.markPublished({ eventId: event.id, workerId: this.options.workerId }),
        "mark event published",
      );
      log.info("outbox.published");
    } catch (error) {
      const permanent = error instanceof PermanentDeliveryError;
      if (!permanent && event.attempt < this.options.maxAttempts) {
        const delayMs = generationBackoffMs(event.attempt, this.options.random);
        await this.requireTransition(
          this.queue.retry({
            eventId: event.id,
            workerId: this.options.workerId,
            errorCode: error instanceof Error ? error.name : "DELIVERY_ERROR",
            delayMs,
          }),
          "schedule event retry",
        );
        log.warn("outbox.retry-scheduled", { delayMs, error });
      } else {
        const errorCode = permanent ? error.code : "DELIVERY_ATTEMPTS_EXHAUSTED";
        await this.requireTransition(
          this.queue.deadLetter({ eventId: event.id, workerId: this.options.workerId, errorCode }),
          "dead-letter event",
        );
        log.error("outbox.dead-lettered", { errorCode, error });
      }
    }
    return true;
  }

  async run(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      const processed = await this.processOne().catch((error: unknown) => {
        this.logger.error("outbox.publisher-error", { error });
        return false;
      });
      if (!processed) await sleep(this.options.pollMs, signal);
    }
  }

  private async requireTransition(result: Promise<boolean>, action: string): Promise<void> {
    if (!(await result)) throw new Error(`Could not ${action}; event lease was lost`);
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

