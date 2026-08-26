import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MemoryCandidateJobStore } from "../src/candidates/memory-job-store.js";
import type { CatalogProvider } from "../src/candidates/types.js";
import { CandidateWorker } from "../src/candidates/worker.js";
import { NoopLogger } from "../src/observability/logger.js";

const profile = JSON.parse(readFileSync(new URL("./fixtures/brand-profile.valid.json", import.meta.url), "utf8")) as Record<string, unknown>;
const snapshot = {
  provider: "FIXTURE" as const,
  currency: "USD",
  fetchedAt: new Date("2026-08-05T00:00:00.000Z"),
  products: [{
    externalProductId: "71", productType: "t-shirt", name: "Tee", currency: "USD",
    baseCostMinor: 1_500, shippingReserveMinor: 500, shippingCountries: ["US", "JP"],
    placements: ["front"], sizes: ["S"], colors: ["Black"], returnRisk: "LOW" as const,
  }],
};

function setup(provider: CatalogProvider, maxAttempts = 4) {
  const store = new MemoryCandidateJobStore();
  store.profiles.set("revision-1", profile);
  store.enqueue({ id: "job-1", revisionId: "revision-1", correlationId: "corr-1" });
  const worker = new CandidateWorker(store, provider, new NoopLogger(), {
    workerId: "worker-1", leaseSeconds: 30, maxAttempts, pollMs: 100, currency: "USD", random: () => 0.5,
  });
  return { store, worker };
}

describe("candidate worker", () => {
  it("persists one immutable snapshot and its evaluations", async () => {
    const context = setup({ async fetchSnapshot() { return snapshot; } });
    await expect(context.worker.processOne()).resolves.toBe(true);
    expect(context.store.jobs[0]?.status).toBe("SUCCEEDED");
    expect(context.store.completed.get("job-1")?.evaluations[0]?.eligibility).toBe("ELIGIBLE");
  });

  it("defers a provider rate limit without consuming an attempt", async () => {
    const context = setup({ async fetchSnapshot() { throw Object.assign(new Error("limited"), { status: 429 }); } });
    await context.worker.processOne();
    expect(context.store.jobs[0]).toMatchObject({ status: "PENDING", attempts: 0, lastError: "WAITING_FOR_PRINTFUL_RATE_LIMIT" });
  });

  it("honors provider Retry-After for catalog synchronization",async()=>{const before=Date.now(),context=setup({async fetchSnapshot(){throw Object.assign(new Error("limited"),{status:429,retryAfterMs:21000})}});await context.worker.processOne();expect(context.store.jobs[0]).toMatchObject({status:"PENDING",attempts:0,lastError:"WAITING_FOR_PRINTFUL_RATE_LIMIT"});expect(context.store.jobs[0]!.availableAt).toBeGreaterThanOrEqual(before+21000)});

  it("fails an invalid approved profile without retrying", async () => {
    const context = setup({ async fetchSnapshot() { return snapshot; } });
    context.store.profiles.delete("revision-1");
    await context.worker.processOne();
    expect(context.store.jobs[0]).toMatchObject({ status: "FAILED", lastError: "CATALOG_HTTP_422" });
  });
});
