import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MemoryBrandProfileStore } from "../src/brand/memory-store.js";
import { BrandProfileService, type BrandProfileGenerator } from "../src/brand/service.js";
import { GenerationWorker } from "../src/jobs/generation-worker.js";
import { MemoryGenerationJobQueue } from "../src/jobs/memory-generation-queue.js";

const validProfile = JSON.parse(
  readFileSync(new URL("./fixtures/brand-profile.valid.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

async function setup(generator: BrandProfileGenerator, maxAttempts = 4) {
  let now = new Date("2026-08-05T00:00:00.000Z");
  const store = new MemoryBrandProfileStore();
  const service = new BrandProfileService(store);
  const workspace = await service.createWorkspace({ name: "Worker Test", actorId: "test" });
  const submitted = await service.submitOnboarding({ workspaceId: workspace.id, answers: { brand: "Test" }, actorId: "test" });
  const queue = new MemoryGenerationJobQueue(() => now);
  queue.add({ id: submitted.job.id, revisionId: submitted.revision.id });
  const worker = new GenerationWorker(queue, service, generator, {
    workerId: "worker-1",
    leaseSeconds: 30,
    maxAttempts,
    pollMs: 100,
    random: () => 0.5,
  });
  return { store, service, submitted, queue, worker, advance: (ms: number) => (now = new Date(now.getTime() + ms)) };
}

describe("generation worker", () => {
  it("completes a claimed job", async () => {
    const context = await setup({
      async generate() {
        return { profileData: structuredClone(validProfile), promptVersion: "worker.v1", model: "fixture" };
      },
    });
    await expect(context.worker.processOne()).resolves.toBe(true);
    expect(context.store.revisions.get(context.submitted.revision.id)?.status).toBe("REVIEW_REQUIRED");
    expect(context.queue.jobs.get(context.submitted.job.id)?.status).toBe("SUCCEEDED");
  });

  it("schedules a transient error without failing the revision", async () => {
    const context = await setup({
      async generate() {
        throw Object.assign(new Error("rate limited"), { status: 429 });
      },
    });
    await context.worker.processOne();
    expect(context.store.revisions.get(context.submitted.revision.id)?.status).toBe("GENERATING");
    expect(context.queue.jobs.get(context.submitted.job.id)).toMatchObject({
      status: "PENDING",
      attempts: 1,
      lastError: "OPENAI_HTTP_429",
    });
    await expect(context.worker.processOne()).resolves.toBe(false);
    context.advance(5_000);
    await expect(context.worker.processOne()).resolves.toBe(true);
    expect(context.queue.jobs.get(context.submitted.job.id)?.attempts).toBe(2);
  });

  it("permanently fails invalid structured output", async () => {
    const context = await setup({
      async generate() {
        return { profileData: { invalid: true }, promptVersion: "worker.v1", model: "fixture" };
      },
    });
    await context.worker.processOne();
    expect(context.store.revisions.get(context.submitted.revision.id)).toMatchObject({
      status: "GENERATION_FAILED",
      failureCode: "SCHEMA_VALIDATION_FAILED",
    });
    expect(context.queue.jobs.get(context.submitted.job.id)).toMatchObject({
      status: "FAILED",
      lastError: "SCHEMA_VALIDATION_FAILED",
    });
  });

  it("fails a transient error after the maximum attempt", async () => {
    const context = await setup(
      {
        async generate() {
          throw Object.assign(new Error("rate limited"), { status: 429 });
        },
      },
      1,
    );
    await context.worker.processOne();
    expect(context.store.revisions.get(context.submitted.revision.id)?.status).toBe("GENERATION_FAILED");
    expect(context.queue.jobs.get(context.submitted.job.id)?.status).toBe("FAILED");
  });

  it("cleans up a final-attempt job whose worker lost its lease", async () => {
    const context = await setup(
      {
        async generate() {
          throw new Error("generator must not be called for cleanup");
        },
      },
      1,
    );
    await context.queue.claim({ workerId: "crashed-worker", leaseSeconds: 30, maxAttempts: 1 });
    context.advance(30_001);
    await expect(context.worker.processOne()).resolves.toBe(true);
    expect(context.store.revisions.get(context.submitted.revision.id)).toMatchObject({
      status: "GENERATION_FAILED",
      failureCode: "LEASE_EXHAUSTED",
    });
    expect(context.queue.jobs.get(context.submitted.job.id)).toMatchObject({ status: "FAILED", attempts: 2 });
  });
});
