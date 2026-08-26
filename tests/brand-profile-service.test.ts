import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MemoryBrandProfileStore } from "../src/brand/memory-store.js";
import { BrandProfileService, type BrandProfileGenerator } from "../src/brand/service.js";

const validProfile = JSON.parse(
  readFileSync(new URL("./fixtures/brand-profile.valid.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

const validGenerator: BrandProfileGenerator = {
  async generate() {
    return { profileData: structuredClone(validProfile), promptVersion: "test.v1", model: "fixture-model" };
  },
};

async function setup() {
  const store = new MemoryBrandProfileStore();
  const service = new BrandProfileService(store);
  const workspace = await service.createWorkspace({ name: "Seoul Side Studio", actorId: "user-1" });
  return { store, service, workspace };
}

describe("brand profile workflow", () => {
  it("returns the same onboarding revision for the same workspace correlation key",async()=>{const store=new MemoryBrandProfileStore(),service=new BrandProfileService(store),workspace=await service.createWorkspace({name:"Brand",actorId:"admin"}),input={workspaceId:workspace.id,answers:{brandName:"Brand"},actorId:"admin",correlationId:"onboarding-key-1"},first=await service.submitOnboarding(input),second=await service.submitOnboarding(input);expect(second).toEqual(first);expect(store.revisions.size).toBe(1);expect(store.outbox).toHaveLength(1)});
  it("creates a generation job atomically with the revision", async () => {
    const { store, service, workspace } = await setup();
    const result = await service.submitOnboarding({ workspaceId: workspace.id, answers: { brandName: "Seoul Side" }, actorId: "user-1" });
    expect(result.revision).toMatchObject({ revision: 1, status: "GENERATING", workspaceId: workspace.id });
    expect(result.job).toMatchObject({ revisionId: result.revision.id, status: "PENDING" });
    expect(store.outbox).toContainEqual({ topic: "brand-profile.generation-requested", aggregateId: result.revision.id });
  });

  it("validates generated data before review and approval", async () => {
    const { service, workspace } = await setup();
    const submitted = await service.submitOnboarding({ workspaceId: workspace.id, answers: { brandName: "Seoul Side" }, actorId: "user-1" });
    const generated = await service.runGeneration(submitted.revision.id, validGenerator);
    expect(generated).toMatchObject({ status: "REVIEW_REQUIRED", promptVersion: "test.v1", model: "fixture-model" });
    const approved = await service.approveRevision({ revisionId: generated.id, actorId: "approver-1" });
    expect(approved).toMatchObject({ status: "APPROVED", approvedBy: "approver-1" });
  });

  it("supersedes the previous approved revision", async () => {
    const { store, service, workspace } = await setup();
    const first = await service.submitOnboarding({ workspaceId: workspace.id, answers: { version: 1 }, actorId: "user-1" });
    await service.runGeneration(first.revision.id, validGenerator);
    await service.approveRevision({ revisionId: first.revision.id, actorId: "user-1" });
    const second = await service.submitOnboarding({ workspaceId: workspace.id, answers: { version: 2 }, actorId: "user-1" });
    await service.runGeneration(second.revision.id, validGenerator);
    await service.approveRevision({ revisionId: second.revision.id, actorId: "user-1" });
    expect(store.revisions.get(first.revision.id)?.status).toBe("SUPERSEDED");
    expect(store.revisions.get(second.revision.id)?.status).toBe("APPROVED");
  });

  it("stores an operator edit as a new review revision without changing the approved source", async () => {
    const { store, service, workspace } = await setup();
    const submitted = await service.submitOnboarding({ workspaceId: workspace.id, answers: { version: 1 }, actorId: "user-1" });
    await service.runGeneration(submitted.revision.id, validGenerator);
    const approved = await service.approveRevision({ revisionId: submitted.revision.id, actorId: "approver-1" });
    const editedData = structuredClone(validProfile);
    const edited = await service.createEditedRevision({ baseRevisionId: approved.id, profileData: editedData, actorId: "editor-1" });

    expect(edited).toMatchObject({ revision: 2, status: "REVIEW_REQUIRED", promptVersion: "editor.v1", model: "manual", createdBy: "editor-1" });
    expect(store.revisions.get(approved.id)?.status).toBe("APPROVED");
    expect(edited.profileData).not.toBe(editedData);
    expect(store.outbox).toContainEqual({ topic: "brand-profile.review-required", aggregateId: edited.id });
    await expect(service.listRevisions(workspace.id)).resolves.toMatchObject([
      { id: edited.id, revision: 2, status: "REVIEW_REQUIRED" },
      { id: approved.id, revision: 1, status: "APPROVED" },
    ]);
  });

  it("rejects revision history for an unknown workspace", async () => {
    const { service } = await setup();
    await expect(service.listRevisions("missing-workspace")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects an edited revision that does not match the Brand Profile schema", async () => {
    const { service } = await setup();
    expect(() => service.createEditedRevision({ baseRevisionId: "missing", profileData: { invalid: true }, actorId: "editor-1" }))
      .toThrow("validation failed");
  });

  it("marks invalid structured output as failed", async () => {
    const { store, service, workspace } = await setup();
    const submitted = await service.submitOnboarding({ workspaceId: workspace.id, answers: { brandName: "X" }, actorId: "user-1" });
    await expect(
      service.runGeneration(submitted.revision.id, {
        async generate() {
          return { profileData: { invalid: true }, promptVersion: "bad.v1", model: "fixture-model" };
        },
      }),
    ).rejects.toThrow("validation failed");
    expect(store.revisions.get(submitted.revision.id)).toMatchObject({ status: "GENERATION_FAILED", failureCode: "SCHEMA_VALIDATION_FAILED" });
  });

  it("does not approve a revision before review", async () => {
    const { service, workspace } = await setup();
    const submitted = await service.submitOnboarding({ workspaceId: workspace.id, answers: { brandName: "X" }, actorId: "user-1" });
    await expect(service.approveRevision({ revisionId: submitted.revision.id, actorId: "user-1" })).rejects.toMatchObject({
      code: "INVALID_REVISION_STATE",
    });
  });
});
