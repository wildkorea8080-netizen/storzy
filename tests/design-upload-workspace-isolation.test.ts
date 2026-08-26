import { describe, expect, it, vi } from "vitest";
import { DesignAssetService } from "../src/mockups/design-service.js";

describe("디자인 업로드 워크스페이스 격리", () => {
  it("다른 워크스페이스의 미리보기 업로드 URL을 DB 조회 전에 거절한다", async () => {
    const pool = { connect: vi.fn() };
    const inspector = { inspect: vi.fn() };
    const service = new DesignAssetService(pool as never, inspector);
    await expect(service.register({
      workspaceId: "workspace-1",
      candidateId: "candidate-1",
      fileUrl: "https://preview-assets.storzy.local/uploads/workspace-2/00000000-0000-0000-0000-000000000000.png",
      placement: "front",
      technique: "dtg",
      mockupStyleIds: [1],
      actorId: "operator-1",
    })).rejects.toThrow("another workspace");
    expect(inspector.inspect).not.toHaveBeenCalled();
    expect(pool.connect).not.toHaveBeenCalled();
  });
});
