import { describe, expect, it } from "vitest";
import { NoopLogger } from "../src/observability/logger.js";
import { PermanentDeliveryError } from "../src/outbox/event-sinks.js";
import { MemoryOutboxQueue } from "../src/outbox/memory-outbox-queue.js";
import { OutboxPublisher } from "../src/outbox/publisher.js";
import type { EventSink, OutboxEvent } from "../src/outbox/types.js";

const event = {
  id: "event-1",
  topic: "brand-profile.approved",
  aggregateType: "brand_profile_revision",
  aggregateId: "revision-1",
  payload: { revisionId: "revision-1" },
  correlationId: "request-1",
};

function publisher(queue: MemoryOutboxQueue, sink: EventSink, maxAttempts = 3) {
  return new OutboxPublisher(queue, sink, new NoopLogger(), {
    workerId: "outbox-1",
    leaseSeconds: 30,
    maxAttempts,
    pollMs: 100,
    random: () => 0.5,
  });
}

describe("outbox publisher", () => {
  it("marks a delivered event as published", async () => {
    const queue = new MemoryOutboxQueue();
    queue.add(event);
    const delivered: OutboxEvent[] = [];
    await publisher(queue, { async publish(value) { delivered.push(value); } }).processOne();
    expect(delivered).toHaveLength(1);
    expect(queue.events.get(event.id)?.status).toBe("PUBLISHED");
  });

  it("retries a transient sink failure with backoff", async () => {
    let now = new Date("2026-08-05T00:00:00.000Z");
    const queue = new MemoryOutboxQueue(() => now);
    queue.add(event);
    const worker = publisher(queue, { async publish() { throw new Error("temporary"); } });
    await worker.processOne();
    expect(queue.events.get(event.id)).toMatchObject({ status: "PENDING", attempt: 1, lastError: "Error" });
    await expect(worker.processOne()).resolves.toBe(false);
    now = new Date(now.getTime() + 5_000);
    await expect(worker.processOne()).resolves.toBe(true);
  });

  it("dead-letters a permanent delivery error", async () => {
    const queue = new MemoryOutboxQueue();
    queue.add(event);
    await publisher(queue, {
      async publish() { throw new PermanentDeliveryError("UNSUPPORTED_TOPIC", "unsupported"); },
    }).processOne();
    expect(queue.events.get(event.id)).toMatchObject({ status: "DEAD_LETTER", lastError: "UNSUPPORTED_TOPIC" });
  });

  it("dead-letters an expired final-attempt lease without redelivery", async () => {
    let now = new Date("2026-08-05T00:00:00.000Z");
    const queue = new MemoryOutboxQueue(() => now);
    queue.add(event);
    await queue.claim({ workerId: "crashed", leaseSeconds: 30, maxAttempts: 1 });
    now = new Date(now.getTime() + 30_001);
    await publisher(queue, { async publish() { throw new Error("must not deliver"); } }, 1).processOne();
    expect(queue.events.get(event.id)).toMatchObject({ status: "DEAD_LETTER", lastError: "LEASE_EXHAUSTED", attempt: 2 });
  });
});

