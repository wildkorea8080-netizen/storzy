import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PreviewDesignUploadService } from "../src/mockups/preview-upload-service.js";

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))));

function png(): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([137,80,78,71,13,10,26,10]); bytes.set([73,72,68,82],12);
  const view = new DataView(bytes.buffer); view.setUint32(16,100); view.setUint32(20,100);
  return bytes;
}

async function uploads(limits: ConstructorParameters<typeof PreviewDesignUploadService>[1]) {
  const directory = await mkdtemp(join(tmpdir(), "storzy-quota-")); directories.push(directory);
  return new PreviewDesignUploadService(directory, limits);
}

describe("미리보기 디자인 업로드 쿼터", () => {
  it("워크스페이스별 파일 수와 누적 용량을 반환한다", async () => {
    const service = await uploads({ maxFilesPerWorkspace: 3, maxBytesPerWorkspace: 100 });
    await service.save("workspace-a", png(), "image/png");
    await expect(service.usage("workspace-a")).resolves.toEqual({ fileCount: 1, sizeBytes: 24, maxFiles: 3, maxBytes: 100 });
    await expect(service.usage("workspace-b")).resolves.toEqual({ fileCount: 0, sizeBytes: 0, maxFiles: 3, maxBytes: 100 });
  });

  it("파일 수와 누적 byte 한도를 초과하면 저장하지 않는다", async () => {
    const countLimited = await uploads({ maxFilesPerWorkspace: 1, maxBytesPerWorkspace: 100 });
    await countLimited.save("workspace-a", png(), "image/png");
    await expect(countLimited.save("workspace-a", png(), "image/png")).rejects.toMatchObject({ code: "DESIGN_UPLOAD_QUOTA_EXCEEDED" });
    const byteLimited = await uploads({ maxFilesPerWorkspace: 10, maxBytesPerWorkspace: 40 });
    await byteLimited.save("workspace-a", png(), "image/png");
    await expect(byteLimited.save("workspace-a", png(), "image/png")).rejects.toMatchObject({ code: "DESIGN_UPLOAD_QUOTA_EXCEEDED" });
  });

  it("동시 업로드도 검사와 저장을 직렬화해 한도를 넘지 않는다", async () => {
    const service = await uploads({ maxFilesPerWorkspace: 1, maxBytesPerWorkspace: 100 });
    const results = await Promise.allSettled([service.save("workspace-a",png(),"image/png"),service.save("workspace-a",png(),"image/png")]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    await expect(service.usage("workspace-a")).resolves.toMatchObject({ fileCount: 1, sizeBytes: 24 });
  });
});
