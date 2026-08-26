import { describe, expect, it } from "vitest";
import { MemoryBrandProfileStore } from "../src/brand/memory-store.js";
import { BrandProfileService } from "../src/brand/service.js";

describe("워크스페이스 단건 조회", () => {
  it("생성된 워크스페이스를 반환하고 없는 ID는 NOT_FOUND로 거절한다", async () => {
    const service = new BrandProfileService(new MemoryBrandProfileStore());
    const created = await service.createWorkspace({ name: "Lookup test", actorId: "test" });
    await expect(service.getWorkspace(created.id)).resolves.toEqual(created);
    await expect(service.getWorkspace("missing-workspace")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
