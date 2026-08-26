import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryBrandProfileStore } from "../src/brand/memory-store.js";
import { BrandProfileService } from "../src/brand/service.js";
import { createApp } from "../src/http/app.js";
import { MemoryNotificationService } from "../src/notifications/memory-notification-service.js";
import { MemoryCandidateReviewService } from "../src/candidates/memory-review-service.js";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function startApp() {
  const service = new BrandProfileService(new MemoryBrandProfileStore());
  const notifications = new MemoryNotificationService();
  const candidates = new MemoryCandidateReviewService();
  const server = createServer(createApp(service, undefined, notifications, candidates));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}`, notifications, candidates };
}

describe("HTTP app", () => {
  it("lists recent workspaces for the shared admin selector",async()=>{
    const {baseUrl}=await startApp();
    await fetch(`${baseUrl}/api/workspaces`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"Seoul Side Studio",actorId:"admin"})});
    const response=await fetch(`${baseUrl}/api/admin/workspaces?limit=10`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({data:[{name:"Seoul Side Studio",status:"ACTIVE"}]});
  });
  it("creates a workspace and queues onboarding generation", async () => {
    const { baseUrl } = await startApp();
    const workspaceResponse = await fetch(`${baseUrl}/api/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Seoul Side Studio", actorId: "user-1" }),
    });
    expect(workspaceResponse.status).toBe(201);
    const workspaceBody = (await workspaceResponse.json()) as { data: { id: string } };
    const revisionResponse = await fetch(`${baseUrl}/api/workspaces/${workspaceBody.data.id}/brand-profile-revisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-ID": "request-fixture-1", "Idempotency-Key": "onboarding-fixture-1" },
      body: JSON.stringify({ answers: { brandName: "Seoul Side Studio" }, actorId: "user-1" }),
    });
    expect(revisionResponse.status).toBe(202);
    expect(revisionResponse.headers.get("X-Request-ID")).toBe("request-fixture-1");
    await expect(revisionResponse.json()).resolves.toMatchObject({
      data: { revision: { status: "GENERATING", revision: 1 }, job: { correlationId: "onboarding-fixture-1" } },
    });
  });

  it("returns a stable JSON error contract", async () => {
    const { baseUrl } = await startApp();
    const response = await fetch(`${baseUrl}/api/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", actorId: "user-1" }),
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: { code: "INVALID_INPUT", message: "name is required" } });
  });

  it("lists and marks an operator notification as read", async () => {
    const { baseUrl, notifications } = await startApp();
    notifications.notifications.set("notification-1", {
      id: "notification-1",
      workspaceId: "workspace-1",
      revisionId: "revision-1",
      kind: "BRAND_PROFILE_REVIEW_REQUIRED",
      title: "Review",
      message: "Review profile",
      status: "UNREAD",
      correlationId: "request-1",
      readBy: null,
      createdAt: new Date(),
      readAt: null,
    });
    const list = await fetch(`${baseUrl}/api/workspaces/workspace-1/notifications?status=UNREAD`);
    await expect(list.json()).resolves.toMatchObject({ data: [{ id: "notification-1", status: "UNREAD" }] });
    const read = await fetch(`${baseUrl}/api/workspaces/workspace-1/notifications/notification-1/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: "operator-1" }),
    });
    expect(read.status).toBe(200);
    await expect(read.json()).resolves.toMatchObject({ data: { status: "READ", readBy: "operator-1" } });
  });

  it("lists candidates by score and records an idempotent review decision", async () => {
    const { baseUrl, candidates } = await startApp();
    candidates.job = { id: "job-1", revisionId: "revision-1", status: "SUCCEEDED", catalogSnapshotId: "snapshot-1", snapshotProvider: "FIXTURE", snapshotCurrency: "USD", snapshotFetchedAt: new Date(), lastError: null };
    candidates.items.set("candidate-1", {
      workspaceId: "workspace-1", id: "candidate-1", jobId: "job-1", externalProductId: "71",
      productType: "t-shirt", productName: "Tee", eligibility: "ELIGIBLE", exclusionReasons: [], score: 87.5,
      scoreBreakdown: { margin: 85 }, evidence: {}, recommendedRetailMinor: 4_445, variableCostMinor: 2_000,
      currency: "USD", marginBasisPoints: 5_500, ruleVersion: "product-candidate.v1", decisionStatus: "UNREVIEWED",
      decisionReason: null, reviewedBy: null, reviewedAt: null, createdAt: new Date(),
    });
    const list = await fetch(`${baseUrl}/api/workspaces/workspace-1/product-candidates?eligibility=ELIGIBLE&sort=score_desc`);
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toMatchObject({ data: { total: 1, items: [{ id: "candidate-1", score: 87.5 }] } });

    const decide = () => fetch(`${baseUrl}/api/workspaces/workspace-1/product-candidates/candidate-1/decision`, {
      method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "decision-1" },
      body: JSON.stringify({ decision: "APPROVED", actorId: "operator-1", reason: "Launch assortment" }),
    });
    const first = await decide();
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({ data: { decisionStatus: "APPROVED", reviewedBy: "operator-1" } });
    const retry = await decide();
    expect(retry.status).toBe(200);
    expect(candidates.idempotency.size).toBe(1);
  });

  it("prevents approving an excluded candidate", async () => {
    const { baseUrl, candidates } = await startApp();
    candidates.items.set("candidate-x", {
      workspaceId: "workspace-1", id: "candidate-x", jobId: "job-1", externalProductId: "x", productType: "hoodie", productName: "Excluded",
      eligibility: "EXCLUDED", exclusionReasons: ["OUT_OF_STOCK_TARGET_MARKET"], score: null, scoreBreakdown: null, evidence: {},
      recommendedRetailMinor: null, variableCostMinor: 2_000, currency: "USD", marginBasisPoints: null, ruleVersion: "product-candidate.v1",
      decisionStatus: "UNREVIEWED", decisionReason: null, reviewedBy: null, reviewedAt: null, createdAt: new Date(),
    });
    const response = await fetch(`${baseUrl}/api/workspaces/workspace-1/product-candidates/candidate-x/decision`, {
      method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "decision-x" },
      body: JSON.stringify({ decision: "APPROVED", actorId: "operator-1" }),
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "CANDIDATE_INELIGIBLE" } });
  });
});
