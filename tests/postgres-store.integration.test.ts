import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { PostgresBrandProfileStore } from "../src/brand/postgres-store.js";
import { BrandProfileService } from "../src/brand/service.js";
import { createPool } from "../src/db/pool.js";
import { PostgresGenerationJobQueue } from "../src/jobs/postgres-generation-queue.js";
import { PostgresOutboxQueue } from "../src/outbox/postgres-outbox-queue.js";
import { OutboxOperations } from "../src/outbox/operations.js";
import { PostgresDomainEventSink } from "../src/events/postgres-domain-event-sink.js";
import type { OutboxEvent } from "../src/outbox/types.js";
import { PostgresCandidateJobStore } from "../src/candidates/postgres-job-store.js";
import { CandidateWorker } from "../src/candidates/worker.js";
import { NoopLogger } from "../src/observability/logger.js";
import { PostgresCandidateReviewService } from "../src/candidates/postgres-review-service.js";
import { PostgresContentJobStore } from "../src/content/postgres-job-store.js";
import { ProductContentReviewService } from "../src/content/review-service.js";
import { ShopifyJobStore } from "../src/shopify/job-store.js";
import { DesignAssetService } from "../src/mockups/design-service.js";
import { MockupJobStore } from "../src/mockups/job-store.js";
import { AdminOverviewService } from "../src/admin/overview-service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const pool = databaseUrl ? createPool(databaseUrl) : null;
const suite = databaseUrl ? describe : describe.skip;
const validProfile = JSON.parse(
  readFileSync(new URL("./fixtures/brand-profile.valid.json", import.meta.url), "utf8"),
) as Record<string, unknown>;
const validContent = JSON.parse(readFileSync(new URL("./fixtures/product-content.valid.json", import.meta.url), "utf8")) as Record<string, unknown>;

afterAll(async () => {
  await pool?.end();
});

suite("PostgreSQL brand profile store", () => {
  it("persists generation, approval, and superseding in real transactions", async () => {
    if (!pool) throw new Error("TEST_DATABASE_URL is required");
    const service = new BrandProfileService(new PostgresBrandProfileStore(pool));
    const workspace = await service.createWorkspace({ name: `Integration ${Date.now()}`, actorId: "integration-test" });
    await expect(new AdminOverviewService(pool).get(workspace.id)).resolves.toMatchObject({ alerts: [] });
    const generator = {
      async generate() {
        return {
          profileData: structuredClone(validProfile),
          promptVersion: "integration.v1",
          model: "fixture-model",
          telemetry: {
            providerRequestId: "req_integration",
            latencyMs: 123,
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
          },
        };
      },
    };

    const first = await service.submitOnboarding({ workspaceId: workspace.id, answers: { version: 1 }, actorId: "integration-test" });
    await service.runGeneration(first.revision.id, generator);
    await service.approveRevision({ revisionId: first.revision.id, actorId: "integration-test" });

    const second = await service.submitOnboarding({ workspaceId: workspace.id, answers: { version: 2 }, actorId: "integration-test" });
    await service.runGeneration(second.revision.id, generator);
    await service.approveRevision({ revisionId: second.revision.id, actorId: "integration-test" });

    await expect(service.getRevision(first.revision.id)).resolves.toMatchObject({ status: "SUPERSEDED", revision: 1 });
    await expect(service.getRevision(second.revision.id)).resolves.toMatchObject({ status: "APPROVED", revision: 2 });

    const outbox = await pool.query<{ topic: string }>(
      "SELECT topic FROM outbox_events WHERE aggregate_id IN ($1, $2) ORDER BY created_at",
      [first.revision.id, second.revision.id],
    );
    expect(outbox.rows.map((row) => row.topic)).toEqual([
      "brand-profile.generation-requested",
      "brand-profile.review-required",
      "brand-profile.approved",
      "brand-profile.generation-requested",
      "brand-profile.review-required",
      "brand-profile.approved",
    ]);
    const telemetry = await pool.query(
      `SELECT provider_request_id, latency_ms, input_tokens, output_tokens, total_tokens
       FROM generation_jobs WHERE revision_id = $1`,
      [second.revision.id],
    );
    expect(telemetry.rows[0]).toEqual({
      provider_request_id: "req_integration",
      latency_ms: 123,
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
    });
  });

  it("claims a job once across workers and allows retry ownership transfer", async () => {
    if (!pool) throw new Error("TEST_DATABASE_URL is required");
    const service = new BrandProfileService(new PostgresBrandProfileStore(pool));
    const workspace = await service.createWorkspace({ name: `Queue ${Date.now()}`, actorId: "integration-test" });
    const submitted = await service.submitOnboarding({ workspaceId: workspace.id, answers: { queue: true }, actorId: "integration-test" });
    const queue = new PostgresGenerationJobQueue(pool);

    const claims = await Promise.all([
      queue.claim({ workerId: "worker-a", leaseSeconds: 30, maxAttempts: 4 }),
      queue.claim({ workerId: "worker-b", leaseSeconds: 30, maxAttempts: 4 }),
    ]);
    const claimed = claims.find((claim) => claim !== null);
    expect(claims.filter((claim) => claim !== null)).toHaveLength(1);
    expect(claimed).toMatchObject({ id: submitted.job.id, attempt: 1 });

    await expect(
      queue.retry({ jobId: submitted.job.id, workerId: claimed!.lockedBy, errorCode: "OPENAI_HTTP_429", delayMs: 0 }),
    ).resolves.toBe(true);
    await expect(
      queue.claim({ workerId: "worker-c", leaseSeconds: 30, maxAttempts: 4 }),
    ).resolves.toMatchObject({ id: submitted.job.id, attempt: 2, lockedBy: "worker-c" });
  });

  it("claims each outbox event once across concurrent publishers", async () => {
    if (!pool) throw new Error("TEST_DATABASE_URL is required");
    await pool.query("UPDATE outbox_events SET status = 'PUBLISHED', published_at = now() WHERE status = 'PENDING'");
    const service = new BrandProfileService(new PostgresBrandProfileStore(pool));
    const workspace = await service.createWorkspace({ name: `Outbox ${Date.now()}`, actorId: "integration-test" });
    const submitted = await service.submitOnboarding({
      workspaceId: workspace.id,
      answers: { outbox: true },
      actorId: "integration-test",
      correlationId: "correlation-integration",
    });
    const queue = new PostgresOutboxQueue(pool);
    const claims = await Promise.all([
      queue.claim({ workerId: "publisher-a", leaseSeconds: 30, maxAttempts: 3 }),
      queue.claim({ workerId: "publisher-b", leaseSeconds: 30, maxAttempts: 3 }),
    ]);
    const claimed = claims.find((event) => event !== null);
    expect(claims.filter((event) => event !== null)).toHaveLength(1);
    expect(claimed).toMatchObject({
      aggregateId: submitted.revision.id,
      correlationId: "correlation-integration",
      attempt: 1,
    });
    await expect(queue.markPublished({ eventId: claimed!.id, workerId: claims[0] ? "publisher-a" : "publisher-b" })).resolves.toBe(true);

    const second = await service.submitOnboarding({
      workspaceId: workspace.id,
      answers: { outbox: "dead-letter" },
      actorId: "integration-test",
      correlationId: "correlation-dead-letter",
    });
    const deadLetterCandidate = await queue.claim({ workerId: "publisher-c", leaseSeconds: 30, maxAttempts: 3 });
    expect(deadLetterCandidate).toMatchObject({ aggregateId: second.revision.id });
    await expect(
      queue.deadLetter({ eventId: deadLetterCandidate!.id, workerId: "publisher-c", errorCode: "TEST_FAILURE" }),
    ).resolves.toBe(true);

    const operations = new OutboxOperations(pool);
    await expect(operations.listDeadLetters()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: deadLetterCandidate!.id, lastError: "TEST_FAILURE" })]),
    );
    await expect(
      operations.requeue({ eventId: deadLetterCandidate!.id, actorId: "operator-1", reason: "Integration recovery" }),
    ).resolves.toBe(true);
    const audit = await pool.query("SELECT actor_id, reason FROM outbox_event_actions WHERE event_id = $1", [deadLetterCandidate!.id]);
    expect(audit.rows[0]).toEqual({ actor_id: "operator-1", reason: "Integration recovery" });
  });

  it("consumes review and approval events idempotently", async () => {
    if (!pool) throw new Error("TEST_DATABASE_URL is required");
    const service = new BrandProfileService(new PostgresBrandProfileStore(pool));
    const workspace = await service.createWorkspace({ name: `Router ${Date.now()}`, actorId: "integration-test" });
    const submitted = await service.submitOnboarding({
      workspaceId: workspace.id,
      answers: { router: true },
      actorId: "integration-test",
      correlationId: "router-correlation",
    });
    await service.runGeneration(submitted.revision.id, {
      async generate() {
        return { profileData: structuredClone(validProfile), promptVersion: "router.v1", model: "fixture" };
      },
    });
    await service.approveRevision({ revisionId: submitted.revision.id, actorId: "integration-test" });
    const rows = await pool.query<{
      id: string;
      topic: string;
      aggregate_type: string;
      aggregate_id: string;
      payload: Record<string, unknown>;
      correlation_id: string;
      attempts: number;
    }>(
      `SELECT id, topic, aggregate_type, aggregate_id, payload, correlation_id, attempts
       FROM outbox_events
       WHERE aggregate_id = $1 AND topic IN ('brand-profile.review-required', 'brand-profile.approved')`,
      [submitted.revision.id],
    );
    const events: OutboxEvent[] = rows.rows.map((row) => ({
      id: row.id,
      topic: row.topic,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      payload: row.payload,
      correlationId: row.correlation_id,
      attempt: row.attempts,
    }));
    const sink = new PostgresDomainEventSink(pool);
    for (const event of events) {
      await sink.publish(event);
      await sink.publish(event);
    }
    const notifications = await pool.query("SELECT id FROM operator_notifications WHERE revision_id = $1", [submitted.revision.id]);
    const candidateJobs = await pool.query("SELECT id FROM product_candidate_jobs WHERE revision_id = $1", [submitted.revision.id]);
    const consumptions = await pool.query("SELECT event_id FROM event_consumptions WHERE event_id = ANY($1::uuid[])", [events.map((event) => event.id)]);
    expect(notifications.rowCount).toBe(1);
    expect(candidateJobs.rowCount).toBe(1);
    expect(consumptions.rowCount).toBe(2);
  });

  it("claims a candidate job once and atomically stores its snapshot and rankings", async () => {
    if (!pool) throw new Error("TEST_DATABASE_URL is required");
    await pool.query("UPDATE product_candidate_jobs SET status = 'FAILED', finished_at = now() WHERE status = 'PENDING'");
    const service = new BrandProfileService(new PostgresBrandProfileStore(pool));
    const workspace = await service.createWorkspace({ name: `Candidates ${Date.now()}`, actorId: "integration-test" });
    const submitted = await service.submitOnboarding({ workspaceId: workspace.id, answers: { candidates: true }, actorId: "integration-test" });
    await service.runGeneration(submitted.revision.id, {
      async generate() { return { profileData: structuredClone(validProfile), promptVersion: "candidate.v1", model: "fixture" }; },
    });
    await service.approveRevision({ revisionId: submitted.revision.id, actorId: "integration-test" });
    const approvalEvent = await pool.query<{ id: string }>(
      "SELECT id FROM outbox_events WHERE aggregate_id = $1 AND topic = 'brand-profile.approved'",
      [submitted.revision.id],
    );
    const jobId = randomUUID();
    await pool.query(
      `INSERT INTO product_candidate_jobs (id, source_event_id, workspace_id, revision_id, correlation_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [jobId, approvalEvent.rows[0]!.id, workspace.id, submitted.revision.id, "candidate-correlation"],
    );
    const store = new PostgresCandidateJobStore(pool);
    const claims = await Promise.all([
      store.claim({ workerId: "candidate-a", leaseSeconds: 30, maxAttempts: 4 }),
      store.claim({ workerId: "candidate-b", leaseSeconds: 30, maxAttempts: 4 }),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const owner = claims[0] ? "candidate-a" : "candidate-b";
    await store.retry({ jobId, workerId: owner, errorCode: "TEST_HANDOFF", delayMs: 0 });

    const worker = new CandidateWorker(store, {
      async fetchSnapshot() {
        return {
          provider: "FIXTURE", currency: "USD", fetchedAt: new Date("2026-08-05T00:00:00Z"),
          products: [
            { externalProductId: "71", productType: "t-shirt", name: "Tee", currency: "USD", baseCostMinor: 1_500, shippingReserveMinor: 500, shippingCountries: ["US", "JP"], placements: ["front"], placementGuidelines: [{ placement: "front", technique: "dtg", printAreaWidthIn: 12, printAreaHeightIn: 16, targetDpi: 150, allowedMockupStyleIds: [1] }], sizes: ["S"], colors: ["Black"], returnRisk: "LOW", selectedTechnique: "dtg", catalogVariants: [{ externalVariantId: "4011", size: "S", color: "Black", imageUrl: null }] },
            { externalProductId: "excluded", productType: "t-shirt", name: "US-only Tee", currency: "USD", baseCostMinor: 1_500, shippingReserveMinor: 500, shippingCountries: ["US"], placements: ["front"], sizes: ["S"], colors: ["Black"], returnRisk: "LOW" },
          ],
        };
      },
    }, new NoopLogger(), { workerId: "candidate-c", leaseSeconds: 30, maxAttempts: 4, pollMs: 100, currency: "USD" });
    await expect(worker.processOne()).resolves.toBe(true);
    const result = await pool.query<{ status: string; snapshot_count: string; candidate_count: string; eligible_count: string }>(
      `SELECT j.status,
        (SELECT count(*) FROM catalog_snapshots s WHERE s.id = j.catalog_snapshot_id) AS snapshot_count,
        (SELECT count(*) FROM product_candidates c WHERE c.job_id = j.id) AS candidate_count,
        (SELECT count(*) FROM product_candidates c WHERE c.job_id = j.id AND c.eligibility = 'ELIGIBLE') AS eligible_count
       FROM product_candidate_jobs j WHERE j.id = $1`, [jobId],
    );
    expect(result.rows[0]).toEqual({ status: "SUCCEEDED", snapshot_count: "1", candidate_count: "2", eligible_count: "1" });

    const candidate = await pool.query<{ id: string }>("SELECT id FROM product_candidates WHERE job_id = $1 AND eligibility = 'ELIGIBLE'", [jobId]);
    const reviews = new PostgresCandidateReviewService(pool);
    await expect(reviews.list({ workspaceId: workspace.id, eligibility: "ELIGIBLE", sort: "score_desc" })).resolves.toMatchObject({
      job: { id: jobId, status: "SUCCEEDED", snapshotProvider: "FIXTURE" }, total: 1,
      items: [{ id: candidate.rows[0]!.id, decisionStatus: "UNREVIEWED" }],
    });
    const decisionInput = {
      workspaceId: workspace.id, candidateId: candidate.rows[0]!.id, decision: "APPROVED" as const,
      actorId: "operator-1", reason: "Integration approval", idempotencyKey: `candidate-decision-${jobId}`,
    };
    await expect(reviews.decide(decisionInput)).resolves.toMatchObject({ decisionStatus: "APPROVED", reviewedBy: "operator-1" });
    await expect(reviews.decide(decisionInput)).resolves.toMatchObject({ decisionStatus: "APPROVED" });
    const actions = await pool.query("SELECT id FROM product_candidate_actions WHERE candidate_id = $1", [candidate.rows[0]!.id]);
    expect(actions.rowCount).toBe(1);
    const contentStore = new PostgresContentJobStore(pool);
    const contentJob = await contentStore.claim({ workerId: "content-a", leaseSeconds: 30, maxAttempts: 4 });
    expect(contentJob).toMatchObject({ candidateId: candidate.rows[0]!.id, attempt: 1 });
    const context = await contentStore.loadContext(candidate.rows[0]!.id);
    const content = structuredClone(validContent);
    (content.pricing_hint as Record<string, unknown>).currency = context.currency;
    (content.pricing_hint as Record<string, unknown>).suggested_retail_minor = context.recommendedRetailMinor;
    await expect(contentStore.complete({ job: contentJob!, workerId: "content-a", generation: { data: content, promptVersion: "integration.v1", model: "fixture" } })).resolves.toBe(true);
    const storedContent = await pool.query("SELECT id FROM product_contents WHERE candidate_id = $1", [candidate.rows[0]!.id]);
    expect(storedContent.rowCount).toBe(1);
    const contentReviews = new ProductContentReviewService(pool);
    const edited = structuredClone(content);
    edited.description = "Editor-reviewed product description.";
    const revision = await contentReviews.createRevision({ workspaceId: workspace.id, productContentId: storedContent.rows[0]!.id, contentData: edited, actorId: "editor-1" });
    expect(revision).toMatchObject({ revision: 2, source: "EDITOR", status: "DRAFT" });
    await expect(contentReviews.approve({ workspaceId: workspace.id, revisionId: revision!.id, actorId: "editor-1", idempotencyKey: `publish-${jobId}` })).resolves.toMatchObject({ status: "APPROVED" });
    const publication = await pool.query("SELECT id,status FROM shopify_publication_jobs WHERE content_revision_id=$1", [revision!.id]);
    expect(publication.rowCount).toBe(1);
    const shopifyStore = new ShopifyJobStore(pool);
    await expect(shopifyStore.claim("shopify-a", 30, 4)).resolves.toBeNull();
    const designs=new DesignAssetService(pool,{async inspect(url){return{url,mimeType:"image/png" as const,sizeBytes:1024,widthPx:1800,heightPx:2400}}});
    await expect(designs.register({workspaceId:workspace.id,candidateId:candidate.rows[0]!.id,fileUrl:"https://assets.example/design.png",placement:"front",technique:"dtg",mockupStyleIds:[1],actorId:"operator-1"})).resolves.toMatchObject({status:"READY"});
    const mockups=new MockupJobStore(pool),mockupJob=await mockups.claim("mockup-a");
    expect(mockupJob).toMatchObject({revisionId:revision!.id,attempt:1});
    await expect(mockups.createPayload(mockupJob!)).resolves.toMatchObject({products:[{catalog_product_id:71,mockup_style_ids:[1]}]});
    await mockups.complete(mockupJob!,"mockup-a",[{catalogVariantId:"4011",placement:"front",styleId:1,url:"https://assets.example/mockup.jpg"}]);
    const shopifyJob = await shopifyStore.claim("shopify-a", 30, 4);
    expect(shopifyJob).toMatchObject({ revisionId: revision!.id, attempt: 1 });
    const shopifyPayload = await shopifyStore.payload(shopifyJob!);
    expect(shopifyPayload).toMatchObject({ input: { status: "DRAFT", vendor: "Seoul Side Studio" } });
    await expect(shopifyStore.success(shopifyJob!.id, "shopify-a", shopifyPayload, "gid://shopify/Product/1", { ok: true })).resolves.toBe(true);
    await expect(reviews.decide({ ...decisionInput, decision: "REJECTED", idempotencyKey: `${decisionInput.idempotencyKey}-conflict` }))
      .rejects.toMatchObject({ code: "CANDIDATE_ALREADY_DECIDED" });
  });
});
