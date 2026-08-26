import { describe, expect, it } from "vitest";
import { MemoryGenerationJobQueue } from "../src/jobs/memory-generation-queue.js";

describe("generation job lease", () => {
  it("prevents a second worker from claiming an active lease and recovers it after expiry", async () => {
    let now = new Date("2026-08-05T00:00:00.000Z");
    const queue = new MemoryGenerationJobQueue(() => now);
    queue.add({ id: "job-1", revisionId: "revision-1" });
    await expect(queue.claim({ workerId: "worker-1", leaseSeconds: 30, maxAttempts: 4 })).resolves.toMatchObject({ attempt: 1 });
    await expect(queue.claim({ workerId: "worker-2", leaseSeconds: 30, maxAttempts: 4 })).resolves.toBeNull();
    now = new Date(now.getTime() + 30_001);
    await expect(queue.claim({ workerId: "worker-2", leaseSeconds: 30, maxAttempts: 4 })).resolves.toMatchObject({
      attempt: 2,
      lockedBy: "worker-2",
    });
  });

  it("rejects updates from a worker that does not own the lease", async () => {
    const queue = new MemoryGenerationJobQueue();
    queue.add({ id: "job-1", revisionId: "revision-1" });
    await queue.claim({ workerId: "worker-1", leaseSeconds: 30, maxAttempts: 4 });
    await expect(queue.retry({ jobId: "job-1", workerId: "worker-2", errorCode: "X", delayMs: 1000 })).resolves.toBe(false);
    await expect(queue.extendLease({ jobId: "job-1", workerId: "worker-2", leaseSeconds: 30 })).resolves.toBe(false);
  });
});

